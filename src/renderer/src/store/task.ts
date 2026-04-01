import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Task } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'
import {
  buildPendingOperationKey,
  hasPendingOperation,
  pendingOperations,
  runAsyncAction
} from '../services/runAsyncAction'
import { useSubTaskStore } from './subtask'

const TASK_OPERATION_TYPES = {
  create: 'task:create',
  toggle: 'task:toggle',
  delete: 'task:delete',
  update: 'task:update',
  clearCompleted: 'task:clear-completed',
  reorder: 'task:reorder'
} as const

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)
  const pendingCounts = ref<Record<number, number>>({})
  let latestFetchRequestId = 0

  const { repositories, toast } = useAppRuntime()
  const taskRepository = repositories.task
  const notifyError = (message: string) => toast.show(message)

  function runTaskAction<T>(
    options: Parameters<typeof runAsyncAction<T>>[0]
  ) {
    return runAsyncAction({
      ...options,
      notifyError
    })
  }

  const isCreatingTask = computed(() => hasPendingOperation({ type: TASK_OPERATION_TYPES.create }))
  const isClearingCompleted = computed(() =>
    hasPendingOperation({ type: TASK_OPERATION_TYPES.clearCompleted })
  )
  const isReorderingTasks = computed(() =>
    hasPendingOperation({ type: TASK_OPERATION_TYPES.reorder })
  )

  function _adjustPendingCount(categoryId: number, delta: number) {
    const current = pendingCounts.value[categoryId] ?? 0
    pendingCounts.value[categoryId] = Math.max(0, current + delta)
  }

  function restorePendingCount(
    categoryId: number,
    previousPendingCount: number,
    hadPendingCount: boolean
  ) {
    if (hadPendingCount) {
      pendingCounts.value[categoryId] = previousPendingCount
      return
    }

    delete pendingCounts.value[categoryId]
  }

  function restoreTaskOrder(previousOrderedIds: number[]) {
    const tasksById = new Map(tasks.value.map((task) => [task.id, task]))
    const restoredTasks = previousOrderedIds
      .map((id) => tasksById.get(id))
      .filter((task): task is Task => Boolean(task))

    if (restoredTasks.length === tasks.value.length) {
      tasks.value = restoredTasks
    }
  }

  function isTaskDeleting(id: number) {
    return hasPendingOperation({ type: TASK_OPERATION_TYPES.delete, entityId: id })
  }

  function isTaskSaving(id: number) {
    return hasPendingOperation({ type: TASK_OPERATION_TYPES.update, entityId: id })
  }

  function isTaskToggling(id: number) {
    return hasPendingOperation({ type: TASK_OPERATION_TYPES.toggle, entityId: id })
  }

  function isTaskBusy(id: number) {
    return isTaskDeleting(id) || isTaskSaving(id) || isTaskToggling(id)
  }

  async function initPendingCounts() {
    try {
      pendingCounts.value = await taskRepository.getPendingTaskCounts()
    } catch (error) {
      console.error('[taskStore] initPendingCounts failed', error)
    }
  }

  async function fetchTasks(categoryId: number) {
    const requestId = ++latestFetchRequestId
    isLoading.value = true

    try {
      const nextTasks = await taskRepository.getTasks(categoryId)

      if (requestId !== latestFetchRequestId) {
        return
      }

      tasks.value = nextTasks
      const pending = nextTasks.filter(
        (task) => !task.is_completed && task.parent_id === null
      ).length
      pendingCounts.value[categoryId] = pending
    } catch (error) {
      console.error('[taskStore] fetchTasks failed', error)
      toast.show('加载任务列表失败，请重试')
      throw error
    } finally {
      if (requestId === latestFetchRequestId) {
        isLoading.value = false
      }
    }
  }

  function clearTasks() {
    tasks.value = []
  }

  async function addTask(content: string, categoryId: number) {
    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.create, categoryId),
      type: TASK_OPERATION_TYPES.create,
      entityId: categoryId,
      execute: () => taskRepository.createTask(content, categoryId),
      onSuccess: (newTask) => {
        tasks.value.unshift(newTask)
        _adjustPendingCount(categoryId, 1)
      },
      errorMessage: '创建任务失败，请重试',
      logPrefix: '[taskStore] addTask failed'
    })
  }

  async function toggleTask(id: number, categoryId: number) {
    const task = tasks.value.find((item) => item.id === id)
    if (!task) return false

    const subTaskStore = useSubTaskStore()
    const subTasks = subTaskStore.subTasksMap[id]
    const nextCompleted = !task.is_completed
    const previousTaskCompleted = task.is_completed
    const previousSubtaskDone = task.subtask_done
    const previousPendingCount = pendingCounts.value[categoryId] ?? 0
    const hadPendingCount = categoryId in pendingCounts.value
    const previousSubTaskStates = subTasks?.map((subTask) => ({
      id: subTask.id,
      is_completed: subTask.is_completed
    }))

    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.toggle, id),
      type: TASK_OPERATION_TYPES.toggle,
      entityId: id,
      before: () => {
        task.is_completed = nextCompleted
        _adjustPendingCount(categoryId, nextCompleted ? -1 : 1)

        if (nextCompleted && subTasks) {
          subTasks.forEach((subTask) => {
            subTask.is_completed = true
          })
          subTaskStore.syncParentTaskStats(id)
        }
      },
      execute: async () => {
        await taskRepository.setTaskCompleted(id, nextCompleted)

        if (nextCompleted) {
          await taskRepository.batchCompleteSubTasks(id)
        }
      },
      rollback: () => {
        task.is_completed = previousTaskCompleted
        restorePendingCount(categoryId, previousPendingCount, hadPendingCount)

        if (subTasks && previousSubTaskStates) {
          const stateById = new Map(
            previousSubTaskStates.map((subTask) => [subTask.id, subTask.is_completed])
          )

          subTasks.forEach((subTask) => {
            const previousSubTaskCompleted = stateById.get(subTask.id)
            if (previousSubTaskCompleted !== undefined) {
              subTask.is_completed = previousSubTaskCompleted
            }
          })

          subTaskStore.syncParentTaskStats(id)
        } else {
          task.subtask_done = previousSubtaskDone
        }
      },
      onError: async () => {
        try {
          await taskRepository.setTaskCompleted(id, previousTaskCompleted)

          if (previousSubTaskStates) {
            await Promise.all(
              previousSubTaskStates.map((subTask) =>
                taskRepository.setTaskCompleted(subTask.id, subTask.is_completed)
              )
            )
          }
        } catch (error) {
          console.error('[taskStore] toggleTask compensation failed', error)
        }
      },
      errorMessage: '更新任务状态失败，请重试',
      logPrefix: '[taskStore] toggleTask failed'
    })
  }

  async function deleteTask(id: number, categoryId: number) {
    const index = tasks.value.findIndex((task) => task.id === id)
    if (index === -1) return false

    const task = tasks.value[index]
    const previousTasks = tasks.value.slice()
    const previousPendingCount = pendingCounts.value[categoryId] ?? 0
    const hadPendingCount = categoryId in pendingCounts.value

    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.delete, id),
      type: TASK_OPERATION_TYPES.delete,
      entityId: id,
      before: () => {
        if (!task.is_completed) {
          _adjustPendingCount(categoryId, -1)
        }

        tasks.value.splice(index, 1)
      },
      execute: () => taskRepository.deleteTask(id),
      rollback: () => {
        tasks.value = previousTasks
        restorePendingCount(categoryId, previousPendingCount, hadPendingCount)
      },
      errorMessage: '删除任务失败，请重试',
      logPrefix: '[taskStore] deleteTask failed'
    })
  }

  async function updateTaskContent(id: number, content: string) {
    const task = tasks.value.find((item) => item.id === id)
    if (!task) return false

    const previousContent = task.content

    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.update, id),
      type: TASK_OPERATION_TYPES.update,
      entityId: id,
      before: () => {
        task.content = content
      },
      execute: () => taskRepository.updateTask(id, { content }),
      rollback: () => {
        task.content = previousContent
      },
      errorMessage: '保存任务失败，请重试',
      logPrefix: '[taskStore] updateTaskContent failed'
    })
  }

  async function clearCompletedTasks(categoryId: number) {
    const completedIds = tasks.value.filter((task) => task.is_completed).map((task) => task.id)
    if (completedIds.length === 0) return undefined

    const completedIdSet = new Set(completedIds)
    const previousTasks = tasks.value.slice()

    const success = await runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.clearCompleted, 'current'),
      type: TASK_OPERATION_TYPES.clearCompleted,
      entityId: 'current',
      before: () => {
        tasks.value = tasks.value.filter((task) => !completedIdSet.has(task.id))
      },
      execute: async () => {
        const deletedCount = await taskRepository.clearCompletedTasks(categoryId)

        if (deletedCount !== completedIds.length) {
          throw new Error(
            `[taskStore] clearCompletedTasks mismatch: expected ${completedIds.length}, got ${deletedCount}`
          )
        }
      },
      rollback: () => {
        tasks.value = previousTasks
      },
      errorMessage: '清空已完成失败，请重试',
      logPrefix: '[taskStore] clearCompletedTasks failed'
    })

    return success ? completedIds : undefined
  }

  function removePendingCount(id: number) {
    delete pendingCounts.value[id]
  }

  async function reorderTasks(previousOrderedIds: number[]) {
    const orderedIds = tasks.value.map((task) => task.id)

    if (
      previousOrderedIds.length === orderedIds.length &&
      previousOrderedIds.every((taskId, index) => taskId === orderedIds[index])
    ) {
      return true
    }

    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.reorder, 'current'),
      type: TASK_OPERATION_TYPES.reorder,
      entityId: 'current',
      execute: () => taskRepository.reorderTasks(orderedIds),
      rollback: () => {
        restoreTaskOrder(previousOrderedIds)
      },
      errorMessage: '保存排序失败，请重试',
      logPrefix: '[taskStore] reorderTasks failed'
    })
  }

  return {
    tasks,
    isLoading,
    pendingCounts,
    pendingOperations,
    isCreatingTask,
    isClearingCompleted,
    isReorderingTasks,
    _adjustPendingCount,
    initPendingCounts,
    fetchTasks,
    clearTasks,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskContent,
    clearCompletedTasks,
    removePendingCount,
    reorderTasks,
    isTaskDeleting,
    isTaskSaving,
    isTaskToggling,
    isTaskBusy
  }
})
