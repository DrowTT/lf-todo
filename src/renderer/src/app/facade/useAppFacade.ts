import { storeToRefs } from 'pinia'
import { DEFAULT_TASK_PRIORITY } from '../../../../shared/constants/task'
import type { TaskDueState, TaskPriority } from '../../../../shared/types/models'
import { useArchiveStore } from '../../store/archive'
import { useAppSessionStore } from '../../store/appSession'
import { useCategoryStore } from '../../store/category'
import { useGlobalSearchStore } from '../../store/globalSearch'
import { useSubTaskStore } from '../../store/subtask'
import { useTaskStore } from '../../store/task'
import { useUndoStore } from '../../store/undo'

const UNDO_LABEL = '撤销'

export function useAppFacade() {
  const appSessionStore = useAppSessionStore()
  const categoryStore = useCategoryStore()
  const taskStore = useTaskStore()
  const archiveStore = useArchiveStore()
  const globalSearchStore = useGlobalSearchStore()
  const subTaskStore = useSubTaskStore()
  const undoStore = useUndoStore()
  let latestTaskRequestId = 0

  const { currentMainView, taskPaneView } = storeToRefs(appSessionStore)
  const { categories, currentCategoryId } = storeToRefs(categoryStore)
  const { tasks, isLoading, pendingCounts } = storeToRefs(taskStore)
  const { groups: archivedTaskGroups, isLoading: isArchiveLoading } = storeToRefs(archiveStore)
  const { subTasksMap, expandedTaskIds } = storeToRefs(subTaskStore)

  function registerUndo(text: string, undo: () => Promise<boolean>) {
    undoStore.register({
      label: UNDO_LABEL,
      text,
      undo
    })
  }

  function isSystemCategory(categoryId: number) {
    return categoryStore.categories.some((category) => category.id === categoryId && category.is_system)
  }

  async function fetchCurrentTaskPane() {
    if (appSessionStore.taskPaneView === 'archive') {
      taskStore.clearTasks()
      subTaskStore.reset()
      await archiveStore.fetchGroups()
      return
    }

    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) {
      taskStore.clearTasks()
      subTaskStore.reset()
      return
    }

    await fetchTasks(categoryId)
  }

  async function ensureCategoryReady(categoryId: number) {
    if (categoryStore.currentCategoryId !== categoryId) {
      await selectCategory(categoryId)
      return
    }

    if (appSessionStore.taskPaneView !== 'active') {
      appSessionStore.setTaskPaneView('active')
      await fetchTasks(categoryId)
    }
  }

  async function fetchCategories() {
    const hasCurrentCategory = await categoryStore.fetchCategories()
    await taskStore.initPendingCounts()

    if (appSessionStore.currentMainView !== 'tasks') {
      return
    }

    if (appSessionStore.taskPaneView === 'archive') {
      taskStore.clearTasks()
      subTaskStore.reset()
      await archiveStore.fetchGroups()
      return
    }

    if (hasCurrentCategory && categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
      return
    }

    taskStore.clearTasks()
    subTaskStore.reset()
  }

  async function addCategory(name: string) {
    await categoryStore.addCategory(name)
    appSessionStore.setTaskPaneView('active')

    if (categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
    }
  }

  async function deleteCategory(id: number) {
    taskStore.removePendingCount(id)
    await categoryStore.deleteCategory(id)
    await taskStore.initPendingCounts()

    if (appSessionStore.taskPaneView === 'archive') {
      await archiveStore.fetchGroups()
      return
    }

    if (categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
      return
    }

    taskStore.clearTasks()
    subTaskStore.reset()
  }

  async function updateCategory(id: number, name: string) {
    await categoryStore.updateCategory(id, name)
    if (appSessionStore.taskPaneView === 'archive') {
      await archiveStore.fetchGroups()
    }
  }

  async function selectCategory(id: number) {
    appSessionStore.setCurrentMainView('tasks')
    appSessionStore.setTaskPaneView('active')
    categoryStore.selectCategory(id)
    archiveStore.clearSelection()
    subTaskStore.reset()
    await fetchTasks(id)
  }

  async function selectArchivePane() {
    if (
      appSessionStore.currentMainView === 'tasks' &&
      appSessionStore.taskPaneView === 'archive'
    ) {
      return
    }

    appSessionStore.setCurrentMainView('tasks')
    appSessionStore.setTaskPaneView('archive')
    taskStore.clearTasks()
    subTaskStore.reset()
    archiveStore.clearSelection()
    await archiveStore.fetchGroups()
  }

  async function fetchTasks(categoryId = categoryStore.currentCategoryId) {
    if (!categoryId) {
      taskStore.clearTasks()
      subTaskStore.reset()
      return
    }

    const requestId = ++latestTaskRequestId
    await taskStore.fetchTasks(categoryId)

    if (requestId !== latestTaskRequestId || categoryStore.currentCategoryId !== categoryId) {
      return
    }

    subTaskStore.loadExpandedForCategory(categoryId)
    await subTaskStore.fetchExpandedSubTasks(subTaskStore.expandedTaskIds)
  }

  async function addTask(
    content: string,
    options?: {
      dueState?: TaskDueState
      priority?: TaskPriority
    }
  ) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId || appSessionStore.taskPaneView !== 'active') return false

    return await taskStore.addTask(
      content,
      categoryId,
      options?.dueState,
      options?.priority ?? DEFAULT_TASK_PRIORITY
    )
  }

  async function toggleTask(id: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId || appSessionStore.taskPaneView !== 'active') return false

    return await taskStore.toggleTask(id)
  }

  async function deleteTask(id: number) {
    const viewCategoryId = categoryStore.currentCategoryId
    if (!viewCategoryId || appSessionStore.taskPaneView !== 'active') return false

    const deleted = await taskStore.deleteTask(id)
    if (!deleted) return false

    subTaskStore.removeTask(id, viewCategoryId)
    const persistReorder = !isSystemCategory(viewCategoryId)

    registerUndo('任务已删除', async () => {
      await ensureCategoryReady(viewCategoryId)
      await taskStore.restoreDeletedTask(deleted, {
        persistReorder,
        viewCategoryId
      })
      return true
    })

    return deleted
  }

  async function updateTaskContent(id: number, content: string) {
    if (appSessionStore.taskPaneView !== 'active') return false
    return await taskStore.updateTaskContent(id, content)
  }

  async function archiveCompletedTasks() {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId || appSessionStore.taskPaneView !== 'active') {
      return undefined
    }

    const archived = await taskStore.archiveCompletedTasks(categoryId)
    if (!archived) {
      return undefined
    }

    subTaskStore.removeCompletedTasks(archived.taskIds, categoryId)

    registerUndo(`已归档 ${archived.taskIds.length} 个已完成任务`, async () => {
      await archiveStore.restoreTasks(archived.taskIds)
      await categoryStore.fetchCategories()
      await taskStore.initPendingCounts()
      await ensureCategoryReady(categoryId)
      return true
    })

    return archived
  }

  async function archiveTask(id: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId || appSessionStore.taskPaneView !== 'active') {
      return undefined
    }

    const archived = await taskStore.archiveTask(id)
    if (!archived) {
      return undefined
    }

    subTaskStore.removeTask(id, categoryId)

    registerUndo('任务已归档', async () => {
      await archiveStore.restoreTasks([id])
      await categoryStore.fetchCategories()
      await taskStore.initPendingCounts()
      await ensureCategoryReady(categoryId)
      return true
    })

    return archived
  }

  async function fetchArchivedTaskGroups() {
    await archiveStore.fetchGroups()
  }

  async function restoreArchivedTasks(ids: number[]) {
    if (ids.length === 0) {
      return 0
    }

    const restoredCount = await archiveStore.restoreTasks(ids)
    await categoryStore.fetchCategories()
    await taskStore.initPendingCounts()

    if (appSessionStore.taskPaneView === 'active' && categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
    }

    return restoredCount
  }

  async function revealTask(taskId: number, categoryId: number) {
    globalSearchStore.markTaskForReveal(taskId)

    if (
      appSessionStore.currentMainView !== 'tasks' ||
      appSessionStore.taskPaneView !== 'active' ||
      categoryStore.currentCategoryId !== categoryId
    ) {
      await selectCategory(categoryId)
    }
  }

  async function reorderTasks(previousOrderedIds: number[]) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId || appSessionStore.taskPaneView !== 'active') return false

    return await taskStore.reorderTasks(previousOrderedIds, {
      persist: !isSystemCategory(categoryId)
    })
  }

  async function toggleExpand(taskId: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId || appSessionStore.taskPaneView !== 'active') return false

    return await subTaskStore.toggleExpand(taskId, categoryId)
  }

  async function addSubTask(content: string, parentId: number) {
    if (appSessionStore.taskPaneView !== 'active') return false
    return await subTaskStore.addSubTask(content, parentId)
  }

  async function toggleSubTask(id: number, parentId: number) {
    if (appSessionStore.taskPaneView !== 'active') return false
    return await subTaskStore.toggleSubTask(id, parentId)
  }

  async function deleteSubTask(id: number, parentId: number) {
    if (appSessionStore.taskPaneView !== 'active') return false

    const viewCategoryId = categoryStore.currentCategoryId
    const deleted = await subTaskStore.deleteSubTask(id, parentId)
    if (!deleted) return false

    registerUndo('子任务已删除', async () => {
      const categoryId =
        viewCategoryId ??
        deleted.parentSnapshot?.category_id ??
        taskStore.tasks.find((task) => task.id === parentId)?.category_id

      if (categoryId) {
        await ensureCategoryReady(categoryId)
      }

      await subTaskStore.restoreDeletedSubTask(deleted)
      return true
    })

    return deleted
  }

  async function updateSubTaskContent(id: number, parentId: number, content: string) {
    if (appSessionStore.taskPaneView !== 'active') return false
    return await subTaskStore.updateSubTaskContent(id, parentId, content)
  }

  return {
    appSessionStore,
    categoryStore,
    taskStore,
    archiveStore,
    subTaskStore,
    undoStore,
    currentMainView,
    taskPaneView,
    categories,
    currentCategoryId,
    tasks,
    archivedTaskGroups,
    isLoading,
    isArchiveLoading,
    pendingCounts,
    subTasksMap,
    expandedTaskIds,
    fetchCategories,
    fetchCurrentTaskPane,
    addCategory,
    deleteCategory,
    updateCategory,
    selectCategory,
    selectArchivePane,
    fetchTasks,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskContent,
    archiveTask,
    archiveCompletedTasks,
    fetchArchivedTaskGroups,
    restoreArchivedTasks,
    revealTask,
    reorderTasks,
    toggleExpand,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    updateSubTaskContent
  }
}
