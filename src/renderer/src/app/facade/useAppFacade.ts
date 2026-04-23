import { computed } from 'vue'
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
import {
  ALL_TASKS_VIEW_KEY,
  ALL_TASKS_VIEW_LABEL,
  getCategoryDisplayName,
  getTaskListStorageKey
} from '../../utils/taskNavigation'

const UNDO_LABEL = '撤销'

type ActiveTaskTarget =
  | {
      taskListView: 'all'
    }
  | {
      taskListView: 'category'
      categoryId: number
    }

export function useAppFacade() {
  const appSessionStore = useAppSessionStore()
  const categoryStore = useCategoryStore()
  const taskStore = useTaskStore()
  const archiveStore = useArchiveStore()
  const globalSearchStore = useGlobalSearchStore()
  const subTaskStore = useSubTaskStore()
  const undoStore = useUndoStore()
  let latestTaskRequestId = 0

  const { currentMainView, taskPaneView, taskListView } = storeToRefs(appSessionStore)
  const { categories, currentCategoryId } = storeToRefs(categoryStore)
  const { tasks, isLoading, pendingCounts } = storeToRefs(taskStore)
  const { groups: archivedTaskGroups, isLoading: isArchiveLoading } = storeToRefs(archiveStore)
  const { subTasksMap, expandedTaskIds } = storeToRefs(subTaskStore)

  const inboxCategory = computed(
    () => categories.value.find((category) => category.is_system) ?? null
  )
  const inboxCategoryId = computed(() => inboxCategory.value?.id ?? null)
  const currentCategory = computed(
    () => categories.value.find((category) => category.id === currentCategoryId.value) ?? null
  )
  const isAllTasksView = computed(
    () =>
      currentMainView.value === 'tasks' &&
      taskPaneView.value === 'active' &&
      taskListView.value === 'all'
  )
  const currentTaskScopeKey = computed(() =>
    getTaskListStorageKey(taskListView.value, currentCategoryId.value)
  )
  const currentTaskCreateCategoryId = computed(() => {
    if (taskPaneView.value !== 'active') {
      return null
    }

    if (taskListView.value === 'all') {
      return inboxCategoryId.value
    }

    return currentCategoryId.value
  })
  const currentTaskViewLabel = computed(() => {
    if (taskPaneView.value === 'archive') {
      return '已归档待办'
    }

    if (taskListView.value === 'all') {
      return ALL_TASKS_VIEW_LABEL
    }

    return getCategoryDisplayName(currentCategory.value) || '未选择分类'
  })
  const allPendingCount = computed(() =>
    categories.value.reduce((sum, category) => sum + (pendingCounts.value[category.id] ?? 0), 0)
  )

  function registerUndo(text: string, undo: () => Promise<boolean>) {
    undoStore.register({
      label: UNDO_LABEL,
      text,
      undo
    })
  }

  function getActiveTaskTarget(): ActiveTaskTarget | null {
    if (appSessionStore.taskPaneView !== 'active') {
      return null
    }

    if (appSessionStore.taskListView === 'all') {
      return { taskListView: 'all' }
    }

    if (categoryStore.currentCategoryId === null) {
      return null
    }

    return {
      taskListView: 'category',
      categoryId: categoryStore.currentCategoryId
    }
  }

  async function fetchCurrentTaskPane() {
    if (appSessionStore.taskPaneView === 'archive') {
      taskStore.clearTasks()
      subTaskStore.reset()
      await archiveStore.fetchGroups()
      return
    }

    if (appSessionStore.taskListView === 'all') {
      await fetchAllTasks()
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

  async function ensureTaskTargetReady(target: ActiveTaskTarget) {
    if (target.taskListView === 'all') {
      if (
        currentMainView.value === 'tasks' &&
        taskPaneView.value === 'active' &&
        taskListView.value === 'all'
      ) {
        return
      }

      await selectAllTasksView()
      return
    }

    if (
      currentMainView.value !== 'tasks' ||
      taskPaneView.value !== 'active' ||
      taskListView.value !== 'category' ||
      currentCategoryId.value !== target.categoryId
    ) {
      await selectCategory(target.categoryId)
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

    if (appSessionStore.taskListView === 'all') {
      await fetchAllTasks()
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
    appSessionStore.setTaskListView('category')

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

    if (appSessionStore.taskListView === 'all') {
      await fetchAllTasks()
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
    appSessionStore.setTaskListView('category')
    categoryStore.selectCategory(id)
    archiveStore.clearSelection()
    subTaskStore.reset()
    await fetchTasks(id)
  }

  async function selectAllTasksView() {
    if (
      appSessionStore.currentMainView === 'tasks' &&
      appSessionStore.taskPaneView === 'active' &&
      appSessionStore.taskListView === 'all'
    ) {
      return
    }

    appSessionStore.setCurrentMainView('tasks')
    appSessionStore.setTaskPaneView('active')
    appSessionStore.setTaskListView('all')
    archiveStore.clearSelection()
    subTaskStore.reset()
    await fetchAllTasks()
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

    if (
      requestId !== latestTaskRequestId ||
      appSessionStore.currentMainView !== 'tasks' ||
      appSessionStore.taskPaneView !== 'active' ||
      appSessionStore.taskListView !== 'category' ||
      categoryStore.currentCategoryId !== categoryId
    ) {
      return
    }

    subTaskStore.loadExpandedForScope(categoryId)
    await subTaskStore.fetchExpandedSubTasks(subTaskStore.expandedTaskIds)
  }

  async function fetchAllTasks() {
    const requestId = ++latestTaskRequestId
    await taskStore.fetchAllTasks()

    if (
      requestId !== latestTaskRequestId ||
      appSessionStore.currentMainView !== 'tasks' ||
      appSessionStore.taskPaneView !== 'active' ||
      appSessionStore.taskListView !== 'all'
    ) {
      return
    }

    subTaskStore.loadExpandedForScope(ALL_TASKS_VIEW_KEY)
    await subTaskStore.fetchExpandedSubTasks(subTaskStore.expandedTaskIds)
  }

  async function addTask(
    content: string,
    options?: {
      dueState?: TaskDueState
      priority?: TaskPriority
    }
  ) {
    const categoryId = currentTaskCreateCategoryId.value
    if (!categoryId || appSessionStore.taskPaneView !== 'active') return false

    return await taskStore.addTask(
      content,
      categoryId,
      options?.dueState,
      options?.priority ?? DEFAULT_TASK_PRIORITY
    )
  }

  async function toggleTask(id: number) {
    if (appSessionStore.taskPaneView !== 'active') return false

    return await taskStore.toggleTask(id)
  }

  async function deleteTask(id: number) {
    const activeTarget = getActiveTaskTarget()
    const scopeKey = currentTaskScopeKey.value
    if (!activeTarget || scopeKey === null) return false

    const deleted = await taskStore.deleteTask(id)
    if (!deleted) return false

    subTaskStore.removeTask(id, scopeKey)
    const persistReorder = activeTarget.taskListView !== 'all'

    registerUndo('任务已删除', async () => {
      await ensureTaskTargetReady(activeTarget)
      await taskStore.restoreDeletedTask(deleted, {
        persistReorder,
        viewScopeKey: scopeKey
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
    const activeTarget = getActiveTaskTarget()
    const scopeKey = currentTaskScopeKey.value
    if (!activeTarget || scopeKey === null) {
      return undefined
    }

    if (activeTarget.taskListView === 'all') {
      const archived = await taskStore.archiveAllCompletedTasks()
      if (!archived) {
        return undefined
      }

      subTaskStore.removeCompletedTasks(archived.taskIds, scopeKey)

      registerUndo(`已归档 ${archived.taskIds.length} 个已完成任务`, async () => {
        await archiveStore.restoreTasks(archived.taskIds)
        await categoryStore.fetchCategories()
        await taskStore.initPendingCounts()
        await ensureTaskTargetReady(activeTarget)
        return true
      })

      return archived
    }

    const archived = await taskStore.archiveCompletedTasks(activeTarget.categoryId)
    if (!archived) {
      return undefined
    }

    subTaskStore.removeCompletedTasks(archived.taskIds, scopeKey)

    registerUndo(`已归档 ${archived.taskIds.length} 个已完成任务`, async () => {
      await archiveStore.restoreTasks(archived.taskIds)
      await categoryStore.fetchCategories()
      await taskStore.initPendingCounts()
      await ensureTaskTargetReady(activeTarget)
      return true
    })

    return archived
  }

  async function archiveTask(id: number) {
    const activeTarget = getActiveTaskTarget()
    const scopeKey = currentTaskScopeKey.value
    if (!activeTarget || scopeKey === null) {
      return undefined
    }

    const archived = await taskStore.archiveTask(id)
    if (!archived) {
      return undefined
    }

    subTaskStore.removeTask(id, scopeKey)

    registerUndo('任务已归档', async () => {
      await archiveStore.restoreTasks([id])
      await categoryStore.fetchCategories()
      await taskStore.initPendingCounts()
      await ensureTaskTargetReady(activeTarget)
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
    await fetchCurrentTaskPane()

    return restoredCount
  }

  async function revealTask(taskId: number, categoryId: number) {
    globalSearchStore.markTaskForReveal(taskId)

    if (
      appSessionStore.currentMainView === 'tasks' &&
      appSessionStore.taskPaneView === 'active' &&
      appSessionStore.taskListView === 'all'
    ) {
      return
    }

    if (
      appSessionStore.currentMainView !== 'tasks' ||
      appSessionStore.taskPaneView !== 'active' ||
      appSessionStore.taskListView !== 'category' ||
      categoryStore.currentCategoryId !== categoryId
    ) {
      await selectCategory(categoryId)
    }
  }

  async function reorderTasks(previousOrderedIds: number[]) {
    const activeTarget = getActiveTaskTarget()
    if (!activeTarget || appSessionStore.taskPaneView !== 'active') return false

    return await taskStore.reorderTasks(previousOrderedIds, {
      persist: activeTarget.taskListView !== 'all'
    })
  }

  async function moveTaskToCategory(id: number, targetCategoryId: number) {
    if (appSessionStore.taskPaneView !== 'active') {
      return false
    }

    return await taskStore.moveTaskToCategory(id, targetCategoryId, {
      taskListView: appSessionStore.taskListView,
      currentCategoryId: categoryStore.currentCategoryId,
      scopeKey: currentTaskScopeKey.value
    })
  }

  async function toggleExpand(taskId: number) {
    const scopeKey = currentTaskScopeKey.value
    if (scopeKey === null || appSessionStore.taskPaneView !== 'active') return false

    return await subTaskStore.toggleExpand(taskId, scopeKey)
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
    const activeTarget = getActiveTaskTarget()
    if (!activeTarget || appSessionStore.taskPaneView !== 'active') return false

    const deleted = await subTaskStore.deleteSubTask(id, parentId)
    if (!deleted) return false

    registerUndo('子任务已删除', async () => {
      await ensureTaskTargetReady(activeTarget)
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
    taskListView,
    categories,
    currentCategoryId,
    currentCategory,
    inboxCategory,
    inboxCategoryId,
    isAllTasksView,
    currentTaskScopeKey,
    currentTaskCreateCategoryId,
    currentTaskViewLabel,
    allPendingCount,
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
    selectAllTasksView,
    selectArchivePane,
    fetchTasks,
    fetchAllTasks,
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
    moveTaskToCategory,
    toggleExpand,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    updateSubTaskContent
  }
}
