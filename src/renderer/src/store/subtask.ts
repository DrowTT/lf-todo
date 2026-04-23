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
import { readStoredJson, writeStoredJson } from '../utils/localStorage'
import { useTaskStore } from './task'

const SUBTASK_OPERATION_TYPES = {
  create: 'subtask:create',
  toggle: 'subtask:toggle',
  delete: 'subtask:delete',
  update: 'subtask:update',
  reorder: 'subtask:reorder'
} as const

type ExpandedScopeKey = string | number

const expandedKey = (scopeKey: ExpandedScopeKey) => `lf-todo:expanded-${scopeKey}`

export interface ParentTaskSnapshot {
  is_completed: boolean
  subtask_total: number
  subtask_done: number
  category_id: number
  pendingCount: number
  hadPendingCount: boolean
}

export interface DeletedSubTaskSnapshot {
  task: Task
  parentId: number
  index: number
  parentSnapshot: ParentTaskSnapshot | null
}

function loadExpandedIds(scopeKey: ExpandedScopeKey): Set<number> {
  return new Set(readStoredJson<number[]>(expandedKey(scopeKey), []))
}

function saveExpandedIds(scopeKey: ExpandedScopeKey, ids: Set<number>) {
  writeStoredJson(expandedKey(scopeKey), [...ids])
}

export const useSubTaskStore = defineStore('subTask', () => {
  const subTasksMap = ref<Record<number, Task[]>>({})
  const expandedTaskIds = ref(new Set<number>())
  let latestSubTaskFetchRequestId = 0

  const { repositories, toast } = useAppRuntime()
  const taskRepository = repositories.task
  const notifyError = (message: string) => toast.show(message)

  function runSubTaskAction<T>(options: Parameters<typeof runAsyncAction<T>>[0]) {
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

  function replaceSubTasks(parentId: number, nextSubTasks: Task[]) {
    subTasksMap.value[parentId] = nextSubTasks
  }

  function adjustPendingCountForParent(parentTask: Pick<Task, 'category_id'>, delta: number) {
    const taskStore = useTaskStore()
    taskStore._adjustPendingCount(parentTask.category_id, delta)
  }

  function restoreSubTaskOrder(parentId: number, orderedIds: number[]) {
    const currentSubTasks = subTasksMap.value[parentId]
    if (!currentSubTasks) return

    const subTasksById = new Map(currentSubTasks.map((task) => [task.id, task]))
    const restoredSubTasks = orderedIds
      .map((id) => subTasksById.get(id))
      .filter((task): task is Task => Boolean(task))

    if (restoredSubTasks.length === currentSubTasks.length) {
      subTasksMap.value[parentId] = restoredSubTasks
    }
  }

  function captureParentTaskState(parentId: number): ParentTaskSnapshot | null {
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

  function restoreParentTaskState(parentId: number, snapshot: ParentTaskSnapshot | null) {
    if (!snapshot) return

    const taskStore = useTaskStore()
    const parentTask = taskStore.tasks.find((task) => task.id === parentId)

    if (!parentTask) return

    parentTask.is_completed = snapshot.is_completed
    parentTask.subtask_total = snapshot.subtask_total
    parentTask.subtask_done = snapshot.subtask_done

    if (snapshot.hadPendingCount) {
      taskStore.pendingCounts[snapshot.category_id] = snapshot.pendingCount
    } else {
      delete taskStore.pendingCounts[snapshot.category_id]
    }
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

  function isSubTaskReordering(parentId: number) {
    return hasPendingOperation({ type: SUBTASK_OPERATION_TYPES.reorder, entityId: parentId })
  }

  function isSubTaskBusy(id: number) {
    return isSubTaskDeleting(id) || isSubTaskSaving(id) || isSubTaskToggling(id)
  }

  function reset() {
    latestSubTaskFetchRequestId++
    subTasksMap.value = {}
    expandedTaskIds.value = new Set()
  }

  function loadExpandedForScope(scopeKey: ExpandedScopeKey) {
    latestSubTaskFetchRequestId++
    expandedTaskIds.value = loadExpandedIds(scopeKey)
  }

  function persistExpanded(scopeKey: ExpandedScopeKey) {
    saveExpandedIds(scopeKey, expandedTaskIds.value)
  }

  function setExpanded(taskId: number, scopeKey: ExpandedScopeKey, expanded: boolean) {
    const next = new Set(expandedTaskIds.value)

    if (expanded) {
      next.add(taskId)
    } else {
      next.delete(taskId)
    }

    expandedTaskIds.value = next
    persistExpanded(scopeKey)
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

  async function toggleExpand(taskId: number, scopeKey: ExpandedScopeKey) {
    if (expandedTaskIds.value.has(taskId)) {
      setExpanded(taskId, scopeKey, false)
      return true
    }

    if (!subTasksMap.value[taskId]) {
      try {
        await fetchSubTasks(taskId)
      } catch {
        toast.show('加载子任务失败，请重试')
        return false
      }
    }

    setExpanded(taskId, scopeKey, true)
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
          adjustPendingCountForParent(parentTask, 1)
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
          adjustPendingCountForParent(parentTask, -1)
        }

        if (!nextParentCompleted && parentTask.is_completed) {
          parentTask.is_completed = false
          adjustPendingCountForParent(parentTask, 1)
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
    const subTask = list?.find((task) => task.id === id)
    if (!list || !subTask) return false

    const previousList = list.slice()
    const parentSnapshot = captureParentTaskState(parentId)
    const snapshot: DeletedSubTaskSnapshot = {
      task: { ...subTask },
      parentId,
      index: list.findIndex((task) => task.id === id),
      parentSnapshot
    }

    const success = await runSubTaskAction({
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

    return success ? snapshot : false
  }

  async function restoreDeletedSubTask(snapshot: DeletedSubTaskSnapshot) {
    const created = await taskRepository.createSubTask(snapshot.task.content, snapshot.parentId)

    if (snapshot.task.is_completed) {
      await taskRepository.setTaskCompleted(created.id, true)
    }

    const restoredTask: Task = {
      ...created,
      is_completed: snapshot.task.is_completed
    }

    const currentList = subTasksMap.value[snapshot.parentId] ?? []
    const nextList = currentList.slice()
    nextList.splice(Math.max(0, snapshot.index), 0, restoredTask)
    subTasksMap.value[snapshot.parentId] = nextList
    syncParentTaskStats(snapshot.parentId)
    restoreParentTaskState(snapshot.parentId, snapshot.parentSnapshot)

    return restoredTask
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

  async function reorderSubTasks(parentId: number, previousOrderedIds: number[]) {
    const currentSubTasks = subTasksMap.value[parentId]
    if (!currentSubTasks) return false

    const orderedIds = currentSubTasks.map((task) => task.id)

    if (
      previousOrderedIds.length === orderedIds.length &&
      previousOrderedIds.every((taskId, index) => taskId === orderedIds[index])
    ) {
      return true
    }

    return runSubTaskAction({
      key: buildPendingOperationKey(SUBTASK_OPERATION_TYPES.reorder, parentId),
      type: SUBTASK_OPERATION_TYPES.reorder,
      entityId: parentId,
      execute: () => taskRepository.reorderSubTasks(orderedIds),
      rollback: () => {
        restoreSubTaskOrder(parentId, previousOrderedIds)
      },
      errorMessage: '保存子任务排序失败，请重试',
      logPrefix: '[subTaskStore] reorderSubTasks failed'
    })
  }

  function removeTask(id: number, scopeKey: ExpandedScopeKey) {
    delete subTasksMap.value[id]

    if (expandedTaskIds.value.has(id)) {
      setExpanded(id, scopeKey, false)
    }
  }

  function removeCompletedTasks(ids: number[], scopeKey: ExpandedScopeKey) {
    const next = new Set(expandedTaskIds.value)

    ids.forEach((id) => {
      delete subTasksMap.value[id]
      next.delete(id)
    })

    expandedTaskIds.value = next
    persistExpanded(scopeKey)
  }

  function restoreTaskBundle(
    parentId: number,
    scopeKey: ExpandedScopeKey,
    subTasks: Task[],
    wasExpanded: boolean
  ) {
    subTasksMap.value[parentId] = subTasks
    if (wasExpanded) {
      setExpanded(parentId, scopeKey, true)
      return
    }

    if (expandedTaskIds.value.has(parentId)) {
      setExpanded(parentId, scopeKey, false)
    }
  }

  return {
    subTasksMap,
    expandedTaskIds,
    pendingOperations,
    reset,
    loadExpandedForScope,
    fetchSubTasks,
    fetchExpandedSubTasks,
    toggleExpand,
    syncParentTaskStats,
    replaceSubTasks,
    captureParentTaskState,
    restoreParentTaskState,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    restoreDeletedSubTask,
    updateSubTaskContent,
    reorderSubTasks,
    removeTask,
    removeCompletedTasks,
    restoreTaskBundle,
    isCreatingSubTask,
    isSubTaskDeleting,
    isSubTaskSaving,
    isSubTaskToggling,
    isSubTaskReordering,
    isSubTaskBusy
  }
})
