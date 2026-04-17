import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_TASK_PRIORITY } from '../../../shared/constants/task'
import type { Task, TaskDueState, TaskPriority } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'
import {
  buildPendingOperationKey,
  hasPendingOperation,
  pendingOperations,
  runAsyncAction
} from '../services/runAsyncAction'
import { useCategoryStore } from './category'
import { useSubTaskStore } from './subtask'

const TASK_OPERATION_TYPES = {
  create: 'task:create',
  toggle: 'task:toggle',
  delete: 'task:delete',
  update: 'task:update',
  archive: 'task:archive',
  archiveCompleted: 'task:archive-completed',
  reorder: 'task:reorder'
} as const

const EMPTY_TASK_DUE_STATE: TaskDueState = {
  due_at: null,
  due_precision: null
}

export interface DeletedTaskSnapshot {
  task: Task
  subTasks: Task[]
  wasExpanded: boolean
  previousOrderedIds: number[]
}

export interface ArchivedCompletedSnapshot {
  categoryId: number
  taskIds: number[]
}

export interface ArchivedTaskSnapshot {
  categoryId: number
  taskId: number
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)
  const pendingCounts = ref<Record<number, number>>({})
  let latestFetchRequestId = 0

  const { repositories, toast } = useAppRuntime()
  const categoryStore = useCategoryStore()
  const taskRepository = repositories.task
  const notifyError = (message: string) => toast.show(message)

  function runTaskAction<T>(options: Parameters<typeof runAsyncAction<T>>[0]) {
    return runAsyncAction({
      ...options,
      notifyError
    })
  }

  const isCreatingTask = computed(() => hasPendingOperation({ type: TASK_OPERATION_TYPES.create }))
  const isArchivingCompleted = computed(() =>
    hasPendingOperation({ type: TASK_OPERATION_TYPES.archiveCompleted })
  )
  const isReorderingTasks = computed(() =>
    hasPendingOperation({ type: TASK_OPERATION_TYPES.reorder })
  )

  function _adjustPendingCount(categoryId: number, delta: number) {
    const current = pendingCounts.value[categoryId] ?? 0
    pendingCounts.value[categoryId] = Math.max(0, current + delta)
  }

  function getSystemCategoryId() {
    return categoryStore.categories.find((category) => category.is_system)?.id ?? null
  }

  function adjustPendingCountForTask(task: Pick<Task, 'category_id'>, delta: number) {
    _adjustPendingCount(task.category_id, delta)

    const systemCategoryId = getSystemCategoryId()
    if (systemCategoryId !== null && systemCategoryId !== task.category_id) {
      _adjustPendingCount(systemCategoryId, delta)
    }
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

  function restoreTaskOrder(orderedIds: number[]) {
    const tasksById = new Map(tasks.value.map((task) => [task.id, task]))
    const restoredTasks = orderedIds
      .map((id) => tasksById.get(id))
      .filter((task): task is Task => Boolean(task))

    if (restoredTasks.length === tasks.value.length) {
      tasks.value = restoredTasks
    }
  }

  function captureDeletedTaskSnapshot(taskId: number): DeletedTaskSnapshot | null {
    const task = tasks.value.find((item) => item.id === taskId)
    if (!task) return null

    const subTaskStore = useSubTaskStore()

    return {
      task: { ...task },
      subTasks: (subTaskStore.subTasksMap[taskId] ?? []).map((subTask) => ({ ...subTask })),
      wasExpanded: subTaskStore.expandedTaskIds.has(taskId),
      previousOrderedIds: tasks.value.map((item) => item.id)
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
    return (
      isTaskDeleting(id) ||
      isTaskSaving(id) ||
      isTaskToggling(id) ||
      hasPendingOperation({ type: TASK_OPERATION_TYPES.archive, entityId: id })
    )
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
      const pending = nextTasks.filter((task) => !task.is_completed && task.parent_id === null).length
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

  async function addTask(
    content: string,
    categoryId: number,
    dueState: TaskDueState = EMPTY_TASK_DUE_STATE,
    priority: TaskPriority = DEFAULT_TASK_PRIORITY
  ) {
    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.create, categoryId),
      type: TASK_OPERATION_TYPES.create,
      entityId: categoryId,
      execute: () =>
        taskRepository.createTask({
          content,
          categoryId,
          due_at: dueState.due_at,
          due_precision: dueState.due_precision,
          priority
        }),
      onSuccess: (newTask) => {
        tasks.value.unshift(newTask)
        adjustPendingCountForTask(newTask, 1)
      },
      errorMessage: '创建任务失败，请重试',
      logPrefix: '[taskStore] addTask failed'
    })
  }

  async function toggleTask(id: number) {
    const task = tasks.value.find((item) => item.id === id)
    if (!task) return false

    const subTaskStore = useSubTaskStore()
    const subTasks = subTaskStore.subTasksMap[id]
    const nextCompleted = !task.is_completed
    const previousTaskCompleted = task.is_completed
    const previousSubtaskDone = task.subtask_done
    const previousPendingCounts = {
      taskCategoryId: task.category_id,
      taskCategoryCount: pendingCounts.value[task.category_id] ?? 0,
      hadTaskCategoryCount: task.category_id in pendingCounts.value,
      systemCategoryId: getSystemCategoryId(),
      systemCategoryCount:
        getSystemCategoryId() === null ? 0 : pendingCounts.value[getSystemCategoryId()!] ?? 0,
      hadSystemCategoryCount:
        getSystemCategoryId() === null ? false : getSystemCategoryId()! in pendingCounts.value
    }
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
        adjustPendingCountForTask(task, nextCompleted ? -1 : 1)

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
        restorePendingCount(
          previousPendingCounts.taskCategoryId,
          previousPendingCounts.taskCategoryCount,
          previousPendingCounts.hadTaskCategoryCount
        )
        if (
          previousPendingCounts.systemCategoryId !== null &&
          previousPendingCounts.systemCategoryId !== previousPendingCounts.taskCategoryId
        ) {
          restorePendingCount(
            previousPendingCounts.systemCategoryId,
            previousPendingCounts.systemCategoryCount,
            previousPendingCounts.hadSystemCategoryCount
          )
        }

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

  async function deleteTask(id: number) {
    const index = tasks.value.findIndex((task) => task.id === id)
    if (index === -1) return false

    const task = tasks.value[index]
    const previousTasks = tasks.value.slice()
    const systemCategoryId = getSystemCategoryId()
    const previousPendingCount = pendingCounts.value[task.category_id] ?? 0
    const hadPendingCount = task.category_id in pendingCounts.value
    const previousSystemPendingCount =
      systemCategoryId === null ? 0 : pendingCounts.value[systemCategoryId] ?? 0
    const hadSystemPendingCount =
      systemCategoryId === null ? false : systemCategoryId in pendingCounts.value
    const snapshot = captureDeletedTaskSnapshot(id)

    if (!snapshot) return false

    const success = await runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.delete, id),
      type: TASK_OPERATION_TYPES.delete,
      entityId: id,
      before: () => {
        if (!task.is_completed) {
          adjustPendingCountForTask(task, -1)
        }

        tasks.value.splice(index, 1)
      },
      execute: () => taskRepository.deleteTask(id),
      rollback: () => {
        tasks.value = previousTasks
        restorePendingCount(task.category_id, previousPendingCount, hadPendingCount)
        if (systemCategoryId !== null && systemCategoryId !== task.category_id) {
          restorePendingCount(systemCategoryId, previousSystemPendingCount, hadSystemPendingCount)
        }
      },
      errorMessage: '删除任务失败，请重试',
      logPrefix: '[taskStore] deleteTask failed'
    })

    return success ? snapshot : false
  }

  async function restoreDeletedTask(
    snapshot: DeletedTaskSnapshot,
    options: { reorderToPrevious?: boolean; persistReorder?: boolean; viewCategoryId?: number } = {}
  ) {
    const subTaskStore = useSubTaskStore()
    const createdTask = await taskRepository.createTask({
      content: snapshot.task.content,
      categoryId: snapshot.task.category_id,
      due_at: snapshot.task.due_at,
      due_precision: snapshot.task.due_precision,
      priority: snapshot.task.priority
    })

    if (snapshot.task.is_completed) {
      await taskRepository.setTaskCompleted(createdTask.id, true)
    }

    const restoredSubTasks: Task[] = []
    for (const subTask of snapshot.subTasks) {
      const createdSubTask = await taskRepository.createSubTask(subTask.content, createdTask.id)
      if (subTask.is_completed) {
        await taskRepository.setTaskCompleted(createdSubTask.id, true)
      }
      restoredSubTasks.push({
        ...createdSubTask,
        is_completed: subTask.is_completed
      })
    }

    const restoredTask: Task = {
      ...createdTask,
      is_completed: snapshot.task.is_completed,
      subtask_total: restoredSubTasks.length,
      subtask_done: restoredSubTasks.filter((subTask) => subTask.is_completed).length
    }

    tasks.value = [...tasks.value, restoredTask]
    if (!restoredTask.is_completed) {
      adjustPendingCountForTask(restoredTask, 1)
    }

    subTaskStore.restoreTaskBundle(
      restoredTask.id,
      options.viewCategoryId ?? restoredTask.category_id,
      restoredSubTasks,
      snapshot.wasExpanded
    )

    if (options.reorderToPrevious !== false) {
      const nextOrderedIds = snapshot.previousOrderedIds.map((id) =>
        id === snapshot.task.id ? restoredTask.id : id
      )
      restoreTaskOrder(nextOrderedIds)
      if (options.persistReorder !== false) {
        await taskRepository.reorderTasks(nextOrderedIds)
      }
    }

    return restoredTask
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

  async function updateTaskDue(id: number, dueState: TaskDueState) {
    const task = tasks.value.find((item) => item.id === id)
    if (!task) return false

    const previousDueAt = task.due_at
    const previousDuePrecision = task.due_precision

    if (previousDueAt === dueState.due_at && previousDuePrecision === dueState.due_precision) {
      return true
    }

    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.update, id),
      type: TASK_OPERATION_TYPES.update,
      entityId: id,
      before: () => {
        task.due_at = dueState.due_at
        task.due_precision = dueState.due_precision
      },
      execute: () =>
        taskRepository.updateTask(id, {
          due_at: dueState.due_at,
          due_precision: dueState.due_precision
        }),
      rollback: () => {
        task.due_at = previousDueAt
        task.due_precision = previousDuePrecision
      },
      errorMessage: '保存截止日期失败，请重试',
      logPrefix: '[taskStore] updateTaskDue failed'
    })
  }

  async function updateTaskPriority(id: number, priority: TaskPriority) {
    const task = tasks.value.find((item) => item.id === id)
    if (!task) return false

    const previousPriority = task.priority
    if (previousPriority === priority) {
      return true
    }

    return runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.update, id),
      type: TASK_OPERATION_TYPES.update,
      entityId: id,
      before: () => {
        task.priority = priority
      },
      execute: () => taskRepository.updateTask(id, { priority }),
      rollback: () => {
        task.priority = previousPriority
      },
      errorMessage: '保存优先级失败，请重试',
      logPrefix: '[taskStore] updateTaskPriority failed'
    })
  }

  async function archiveCompletedTasks(categoryId: number) {
    const completedIds = tasks.value.filter((task) => task.is_completed).map((task) => task.id)
    if (completedIds.length === 0) {
      return undefined
    }

    const completedIdSet = new Set(completedIds)
    const previousTasks = tasks.value.slice()

    const success = await runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.archiveCompleted, 'current'),
      type: TASK_OPERATION_TYPES.archiveCompleted,
      entityId: 'current',
      before: () => {
        tasks.value = tasks.value.filter((task) => !completedIdSet.has(task.id))
      },
      execute: async () => {
        const archivedCount = await taskRepository.archiveCompletedTasks(categoryId)
        if (archivedCount !== completedIds.length) {
          throw new Error(
            `[taskStore] archiveCompletedTasks mismatch: expected ${completedIds.length}, got ${archivedCount}`
          )
        }
      },
      rollback: () => {
        tasks.value = previousTasks
      },
      errorMessage: '归档已完成任务失败，请重试',
      logPrefix: '[taskStore] archiveCompletedTasks failed'
    })

    if (!success) {
      return undefined
    }

    return {
      categoryId,
      taskIds: completedIds
    } satisfies ArchivedCompletedSnapshot
  }

  async function archiveTask(id: number) {
    if (typeof taskRepository.archiveTask !== 'function') {
      toast.show('当前环境暂不支持单个归档')
      return false
    }

    const index = tasks.value.findIndex((task) => task.id === id)
    if (index === -1) {
      return false
    }

    const task = tasks.value[index]
    const previousTasks = tasks.value.slice()

    const success = await runTaskAction({
      key: buildPendingOperationKey(TASK_OPERATION_TYPES.archive, id),
      type: TASK_OPERATION_TYPES.archive,
      entityId: id,
      before: () => {
        tasks.value.splice(index, 1)
      },
      execute: () => taskRepository.archiveTask!(id),
      rollback: () => {
        tasks.value = previousTasks
      },
      errorMessage: '归档任务失败，请重试',
      logPrefix: '[taskStore] archiveTask failed'
    })

    if (!success) {
      return false
    }

    return {
      categoryId: task.category_id,
      taskId: task.id
    } satisfies ArchivedTaskSnapshot
  }

  function removePendingCount(id: number) {
    delete pendingCounts.value[id]
  }

  async function reorderTasks(previousOrderedIds: number[], options: { persist?: boolean } = {}) {
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
      execute: async () => {
        if (options.persist === false) {
          return
        }
        await taskRepository.reorderTasks(orderedIds)
      },
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
    isArchivingCompleted,
    isReorderingTasks,
    _adjustPendingCount,
    initPendingCounts,
    fetchTasks,
    clearTasks,
    addTask,
    toggleTask,
    deleteTask,
    restoreDeletedTask,
    updateTaskContent,
    updateTaskDue,
    updateTaskPriority,
    archiveTask,
    archiveCompletedTasks,
    removePendingCount,
    reorderTasks,
    isTaskDeleting,
    isTaskSaving,
    isTaskToggling,
    isTaskBusy
  }
})
