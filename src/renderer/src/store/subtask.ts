import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Task } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'
import {
  buildPendingOperationKey,
  hasPendingOperation,
  pendingOperations,
  runAsyncAction
} from '../services/runAsyncAction'
import { useTaskStore } from './task'

const SUBTASK_OPERATION_TYPES = {
  create: 'subtask:create',
  toggle: 'subtask:toggle',
  delete: 'subtask:delete',
  update: 'subtask:update'
} as const

const expandedKey = (categoryId: number) => `lf-todo:expanded-${categoryId}`

function loadExpandedIds(categoryId: number): Set<number> {
  try {
    const raw = localStorage.getItem(expandedKey(categoryId))
    if (raw) {
      return new Set(JSON.parse(raw) as number[])
    }
  } catch {
    return new Set()
  }

  return new Set()
}

function saveExpandedIds(categoryId: number, ids: Set<number>) {
  localStorage.setItem(expandedKey(categoryId), JSON.stringify([...ids]))
}

export const useSubTaskStore = defineStore('subTask', () => {
  const subTasksMap = ref<Record<number, Task[]>>({})
  const expandedTaskIds = ref(new Set<number>())
  let latestSubTaskFetchRequestId = 0

  const { repositories, toast } = useAppRuntime()
  const taskRepository = repositories.task
  const notifyError = (message: string) => toast.show(message)

  function runSubTaskAction<T>(
    options: Parameters<typeof runAsyncAction<T>>[0]
  ) {
    return runAsyncAction({
      ...options,
      notifyError
    })
  }

  function syncParentTaskStats(parentId: number) {
    const taskStore = useTaskStore()
    const parentTask = taskStore.tasks.find((task) => task.id === parentId)
    const subTasks = subTasksMap.value[parentId]

    if (!parentTask || !subTasks) return

    parentTask.subtask_total = subTasks.length
    parentTask.subtask_done = subTasks.filter((subTask) => subTask.is_completed).length
  }

  function captureParentTaskState(parentId: number) {
    const taskStore = useTaskStore()
    const parentTask = taskStore.tasks.find((task) => task.id === parentId)

    if (!parentTask) return null

    return {
      is_completed: parentTask.is_completed,
      subtask_total: parentTask.subtask_total,
      subtask_done: parentTask.subtask_done,
      category_id: parentTask.category_id,
      pendingCount: taskStore.pendingCounts[parentTask.category_id] ?? 0,
      hadPendingCount: parentTask.category_id in taskStore.pendingCounts
    }
  }

  function restoreParentTaskState(
    parentId: number,
    snapshot: ReturnType<typeof captureParentTaskState>
  ) {
    if (!snapshot) return

    const taskStore = useTaskStore()
    const parentTask = taskStore.tasks.find((task) => task.id === parentId)

    if (!parentTask) return

    parentTask.is_completed = snapshot.is_completed
    parentTask.subtask_total = snapshot.subtask_total
    parentTask.subtask_done = snapshot.subtask_done

    if (snapshot.hadPendingCount) {
      taskStore.pendingCounts[snapshot.category_id] = snapshot.pendingCount
      return
    }

    delete taskStore.pendingCounts[snapshot.category_id]
  }

  function isCreatingSubTask(parentId: number) {
    return hasPendingOperation({ type: SUBTASK_OPERATION_TYPES.create, entityId: parentId })
  }

  function isSubTaskDeleting(id: number) {
    return hasPendingOperation({ type: SUBTASK_OPERATION_TYPES.delete, entityId: id })
  }

  function isSubTaskSaving(id: number) {
    return hasPendingOperation({ type: SUBTASK_OPERATION_TYPES.update, entityId: id })
  }

  function isSubTaskToggling(id: number) {
    return hasPendingOperation({ type: SUBTASK_OPERATION_TYPES.toggle, entityId: id })
  }

  function isSubTaskBusy(id: number) {
    return isSubTaskDeleting(id) || isSubTaskSaving(id) || isSubTaskToggling(id)
  }

  function reset() {
    latestSubTaskFetchRequestId++
    subTasksMap.value = {}
    expandedTaskIds.value = new Set()
  }

  function loadExpandedForCategory(categoryId: number) {
    latestSubTaskFetchRequestId++
    expandedTaskIds.value = loadExpandedIds(categoryId)
  }

  function persistExpanded(categoryId: number) {
    saveExpandedIds(categoryId, expandedTaskIds.value)
  }

  async function fetchSubTasks(parentId: number) {
    const requestId = latestSubTaskFetchRequestId
    try {
      const nextSubTasks = await taskRepository.getSubTasks(parentId)

      if (requestId !== latestSubTaskFetchRequestId) {
        return
      }

      subTasksMap.value[parentId] = nextSubTasks
      syncParentTaskStats(parentId)
    } catch (error) {
      console.error('[subTaskStore] fetchSubTasks failed', error)
      throw error
    }
  }

  async function fetchExpandedSubTasks(expandedIds: Set<number>) {
    const neededIds = [...expandedIds].filter((id) => !subTasksMap.value[id])
    await Promise.all(neededIds.map((id) => fetchSubTasks(id)))
  }

  async function toggleExpand(taskId: number, categoryId: number) {
    if (expandedTaskIds.value.has(taskId)) {
      const next = new Set(expandedTaskIds.value)
      next.delete(taskId)
      expandedTaskIds.value = next
    } else {
      if (!subTasksMap.value[taskId]) {
        try {
          await fetchSubTasks(taskId)
        } catch {
          toast.show('加载子任务失败，请重试')
          return false
        }
      }

      expandedTaskIds.value = new Set(expandedTaskIds.value).add(taskId)
    }

    persistExpanded(categoryId)
    return true
  }

  async function addSubTask(content: string, parentId: number) {
    const taskStore = useTaskStore()
    const parentTask = taskStore.tasks.find((task) => task.id === parentId)
    const parentWasCompleted = parentTask?.is_completed ?? false
    let createdSubTask: Task | null = null

    return runSubTaskAction({
      key: buildPendingOperationKey(SUBTASK_OPERATION_TYPES.create, parentId),
      type: SUBTASK_OPERATION_TYPES.create,
      entityId: parentId,
      execute: async () => {
        createdSubTask = await taskRepository.createSubTask(content, parentId)

        if (parentWasCompleted) {
          await taskRepository.setTaskCompleted(parentId, false)
        }

        return createdSubTask
      },
      onSuccess: (newSubTask) => {
        const currentSubTasks = subTasksMap.value[parentId] ?? []
        subTasksMap.value[parentId] = [...currentSubTasks, newSubTask]
        syncParentTaskStats(parentId)

        if (parentTask && parentWasCompleted) {
          parentTask.is_completed = false
          taskStore._adjustPendingCount(parentTask.category_id, 1)
        }
      },
      onError: async () => {
        try {
          if (createdSubTask) {
            await taskRepository.deleteTask(createdSubTask.id)
          }

          if (parentTask && parentWasCompleted) {
            await taskRepository.setTaskCompleted(parentId, true)
          }
        } catch (error) {
          console.error('[subTaskStore] addSubTask compensation failed', error)
        }
      },
      errorMessage: '创建子任务失败，请重试',
      logPrefix: '[subTaskStore] addSubTask failed'
    })
  }

  async function toggleSubTask(id: number, parentId: number) {
    const list = subTasksMap.value[parentId]
    const subTask = list?.find((task) => task.id === id)
    if (!list || !subTask) return false

    const taskStore = useTaskStore()
    const parentTask = taskStore.tasks.find((task) => task.id === parentId)
    const parentSnapshot = captureParentTaskState(parentId)
    const previousSubTaskCompleted = subTask.is_completed
    const nextCompleted = !subTask.is_completed

    let nextParentCompleted: boolean | null = null
    if (parentTask) {
      const allDoneAfterToggle = list.every((item) =>
        item.id === id ? nextCompleted : item.is_completed
      )

      if (!nextCompleted && parentTask.is_completed) {
        nextParentCompleted = false
      } else if (nextCompleted && allDoneAfterToggle) {
        nextParentCompleted = true
      } else {
        nextParentCompleted = parentTask.is_completed
      }
    }

    return runSubTaskAction({
      key: buildPendingOperationKey(SUBTASK_OPERATION_TYPES.toggle, id),
      type: SUBTASK_OPERATION_TYPES.toggle,
      entityId: id,
      before: () => {
        subTask.is_completed = nextCompleted
        syncParentTaskStats(parentId)

        if (!parentTask || nextParentCompleted === null) return

        if (nextParentCompleted && !parentTask.is_completed) {
          parentTask.is_completed = true
          taskStore._adjustPendingCount(parentTask.category_id, -1)
        }

        if (!nextParentCompleted && parentTask.is_completed) {
          parentTask.is_completed = false
          taskStore._adjustPendingCount(parentTask.category_id, 1)
        }
      },
      execute: async () => {
        await taskRepository.setTaskCompleted(id, nextCompleted)

        if (parentTask && nextParentCompleted !== parentSnapshot?.is_completed) {
          await taskRepository.setTaskCompleted(parentId, Boolean(nextParentCompleted))
        }
      },
      rollback: () => {
        subTask.is_completed = previousSubTaskCompleted
        restoreParentTaskState(parentId, parentSnapshot)
      },
      onError: async () => {
        try {
          await taskRepository.setTaskCompleted(id, previousSubTaskCompleted)

          if (parentSnapshot && nextParentCompleted !== parentSnapshot.is_completed) {
            await taskRepository.setTaskCompleted(parentId, parentSnapshot.is_completed)
          }
        } catch (error) {
          console.error('[subTaskStore] toggleSubTask compensation failed', error)
        }
      },
      errorMessage: '更新子任务状态失败，请重试',
      logPrefix: '[subTaskStore] toggleSubTask failed'
    })
  }

  async function deleteSubTask(id: number, parentId: number) {
    const list = subTasksMap.value[parentId]
    if (!list) return false

    const previousList = list.slice()
    const parentSnapshot = captureParentTaskState(parentId)

    return runSubTaskAction({
      key: buildPendingOperationKey(SUBTASK_OPERATION_TYPES.delete, id),
      type: SUBTASK_OPERATION_TYPES.delete,
      entityId: id,
      before: () => {
        subTasksMap.value[parentId] = list.filter((task) => task.id !== id)
        syncParentTaskStats(parentId)
      },
      execute: () => taskRepository.deleteTask(id),
      rollback: () => {
        subTasksMap.value[parentId] = previousList
        restoreParentTaskState(parentId, parentSnapshot)
      },
      errorMessage: '删除子任务失败，请重试',
      logPrefix: '[subTaskStore] deleteSubTask failed'
    })
  }

  async function updateSubTaskContent(id: number, parentId: number, content: string) {
    const list = subTasksMap.value[parentId]
    const subTask = list?.find((task) => task.id === id)
    if (!subTask) return false

    const previousContent = subTask.content

    return runSubTaskAction({
      key: buildPendingOperationKey(SUBTASK_OPERATION_TYPES.update, id),
      type: SUBTASK_OPERATION_TYPES.update,
      entityId: id,
      before: () => {
        subTask.content = content
      },
      execute: () => taskRepository.updateTask(id, { content }),
      rollback: () => {
        subTask.content = previousContent
      },
      errorMessage: '保存子任务失败，请重试',
      logPrefix: '[subTaskStore] updateSubTaskContent failed'
    })
  }

  function removeTask(id: number, categoryId: number) {
    delete subTasksMap.value[id]

    if (expandedTaskIds.value.has(id)) {
      const next = new Set(expandedTaskIds.value)
      next.delete(id)
      expandedTaskIds.value = next
      persistExpanded(categoryId)
    }
  }

  function removeCompletedTasks(ids: number[], categoryId: number) {
    const next = new Set(expandedTaskIds.value)

    ids.forEach((id) => {
      delete subTasksMap.value[id]
      next.delete(id)
    })

    expandedTaskIds.value = next
    persistExpanded(categoryId)
  }

  return {
    subTasksMap,
    expandedTaskIds,
    pendingOperations,
    reset,
    loadExpandedForCategory,
    fetchSubTasks,
    fetchExpandedSubTasks,
    toggleExpand,
    syncParentTaskStats,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    updateSubTaskContent,
    removeTask,
    removeCompletedTasks,
    isCreatingSubTask,
    isSubTaskDeleting,
    isSubTaskSaving,
    isSubTaskToggling,
    isSubTaskBusy
  }
})
