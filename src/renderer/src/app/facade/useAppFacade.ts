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
  createCategoryTaskView,
  getTaskViewCreateCategoryId,
  getTaskViewLabel,
  getTaskViewScopeKey,
  isAllTasksTaskView,
  isArchiveTaskView,
  isResolvedCategoryTaskView
} from '../../utils/taskNavigation'
import type { TaskView } from '../../utils/taskNavigation'

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

  const { currentMainView, taskPaneView, taskListView, selectedTaskView } =
    storeToRefs(appSessionStore)
  const { categories, currentCategoryId } = storeToRefs(categoryStore)
  const { tasks, isLoading, pendingCounts } = storeToRefs(taskStore)
  const { groups: archivedTaskGroups, isLoading: isArchiveLoading } = storeToRefs(archiveStore)
  const { subTasksMap, expandedTaskIds } = storeToRefs(subTaskStore)

  const inboxCategory = computed(
    () => categories.value.find((category) => category.is_system) ?? null
  )
  const inboxCategoryId = computed(() => inboxCategory.value?.id ?? null)
  const activeTaskCategoryId = computed(() =>
    selectedTaskView.value.kind === 'category' ? selectedTaskView.value.categoryId : null
  )
  const currentCategory = computed(
    () => categories.value.find((category) => category.id === activeTaskCategoryId.value) ?? null
  )
  const isArchiveTaskViewActive = computed(
    () => currentMainView.value === 'tasks' && isArchiveTaskView(selectedTaskView.value)
  )
  const isAllTasksView = computed(
    () => currentMainView.value === 'tasks' && isAllTasksTaskView(selectedTaskView.value)
  )
  const currentTaskScopeKey = computed(() => getTaskViewScopeKey(selectedTaskView.value))
  const currentTaskCreateCategoryId = computed(() =>
    getTaskViewCreateCategoryId(selectedTaskView.value, inboxCategoryId.value)
  )
  const currentTaskViewLabel = computed(() =>
    getTaskViewLabel(selectedTaskView.value, {
      category: currentCategory.value
    })
  )
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

  function isCurrentActiveTaskView(view: TaskView = appSessionStore.selectedTaskView): boolean {
    return !isArchiveTaskView(view)
  }

  function selectTaskView(view: TaskView) {
    appSessionStore.setCurrentMainView('tasks')
    appSessionStore.setSelectedTaskView(view)
  }

  function reconcileCategoryTaskViewAfterCategoryLoad() {
    const view = appSessionStore.selectedTaskView
    if (view.kind !== 'category') {
      return
    }

    const selectedCategoryId = view.categoryId
    const selectedCategoryExists =
      selectedCategoryId !== null &&
      categories.value.some((category) => category.id === selectedCategoryId)

    if (selectedCategoryExists) {
      if (categoryStore.currentCategoryId !== selectedCategoryId) {
        categoryStore.selectCategory(selectedCategoryId)
      }
      appSessionStore.syncSelectedTaskViewCategoryId(selectedCategoryId)
      return
    }

    appSessionStore.syncSelectedTaskViewCategoryId(categoryStore.currentCategoryId)
  }

  function getActiveTaskTarget(): ActiveTaskTarget | null {
    const view = appSessionStore.selectedTaskView
    if (!isCurrentActiveTaskView(view)) {
      return null
    }

    if (isAllTasksTaskView(view)) {
      return { taskListView: 'all' }
    }

    if (!isResolvedCategoryTaskView(view)) {
      return null
    }

    return {
      taskListView: 'category',
      categoryId: view.categoryId
    }
  }

  async function fetchCurrentTaskPane() {
    const view = appSessionStore.selectedTaskView

    if (isArchiveTaskView(view)) {
      taskStore.clearTasks()
      subTaskStore.reset()
      await archiveStore.fetchGroups()
      return
    }

    if (isAllTasksTaskView(view)) {
      await fetchAllTasks()
      return
    }

    const categoryId = view.categoryId
    if (!categoryId) {
      taskStore.clearTasks()
      subTaskStore.reset()
      return
    }

    await fetchTasks(categoryId)
  }

  async function ensureTaskTargetReady(target: ActiveTaskTarget) {
    if (target.taskListView === 'all') {
      if (currentMainView.value === 'tasks' && isAllTasksTaskView(selectedTaskView.value)) {
        return
      }

      await selectAllTasksView()
      return
    }

    if (
      currentMainView.value !== 'tasks' ||
      !isResolvedCategoryTaskView(selectedTaskView.value) ||
      selectedTaskView.value.categoryId !== target.categoryId
    ) {
      await selectCategory(target.categoryId)
    }
  }

  async function fetchCategories() {
    await categoryStore.fetchCategories()
    await taskStore.initPendingCounts()
    reconcileCategoryTaskViewAfterCategoryLoad()

    if (appSessionStore.currentMainView !== 'tasks') {
      return
    }

    const view = appSessionStore.selectedTaskView

    if (isArchiveTaskView(view)) {
      taskStore.clearTasks()
      subTaskStore.reset()
      await archiveStore.fetchGroups()
      return
    }

    if (isAllTasksTaskView(view)) {
      await fetchAllTasks()
      return
    }

    if (isResolvedCategoryTaskView(view)) {
      await fetchTasks(view.categoryId)
      return
    }

    taskStore.clearTasks()
    subTaskStore.reset()
  }

  async function addCategory(name: string) {
    await categoryStore.addCategory(name)
    selectTaskView(createCategoryTaskView(categoryStore.currentCategoryId))

    if (categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
    }
  }

  async function deleteCategory(id: number) {
    taskStore.removePendingCount(id)
    await categoryStore.deleteCategory(id)
    await taskStore.initPendingCounts()
    reconcileCategoryTaskViewAfterCategoryLoad()

    const view = appSessionStore.selectedTaskView

    if (isArchiveTaskView(view)) {
      await archiveStore.fetchGroups()
      return
    }

    if (isAllTasksTaskView(view)) {
      await fetchAllTasks()
      return
    }

    if (isResolvedCategoryTaskView(view)) {
      await fetchTasks(view.categoryId)
      return
    }

    taskStore.clearTasks()
    subTaskStore.reset()
  }

  async function updateCategory(id: number, name: string) {
    await categoryStore.updateCategory(id, name)
    if (isArchiveTaskView(appSessionStore.selectedTaskView)) {
      await archiveStore.fetchGroups()
    }
  }

  async function selectCategory(id: number) {
    categoryStore.selectCategory(id)
    selectTaskView(createCategoryTaskView(id))
    archiveStore.clearSelection()
    subTaskStore.reset()
    await fetchTasks(id)
  }

  async function selectAllTasksView() {
    if (
      appSessionStore.currentMainView === 'tasks' &&
      isAllTasksTaskView(appSessionStore.selectedTaskView)
    ) {
      return
    }

    selectTaskView({ kind: 'system', view: 'all' })
    archiveStore.clearSelection()
    subTaskStore.reset()
    await fetchAllTasks()
  }

  async function selectArchivePane() {
    if (
      appSessionStore.currentMainView === 'tasks' &&
      isArchiveTaskView(appSessionStore.selectedTaskView)
    ) {
      return
    }

    selectTaskView({ kind: 'history', view: 'archive' })
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
      !isResolvedCategoryTaskView(appSessionStore.selectedTaskView) ||
      appSessionStore.selectedTaskView.categoryId !== categoryId
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
      !isAllTasksTaskView(appSessionStore.selectedTaskView)
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
    if (!categoryId || !isCurrentActiveTaskView()) return false

    return await taskStore.addTask(
      content,
      categoryId,
      options?.dueState,
      options?.priority ?? DEFAULT_TASK_PRIORITY
    )
  }

  async function toggleTask(id: number) {
    if (!isCurrentActiveTaskView()) return false

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
    if (!isCurrentActiveTaskView()) return false
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
      isAllTasksTaskView(appSessionStore.selectedTaskView)
    ) {
      return
    }

    if (
      appSessionStore.currentMainView !== 'tasks' ||
      !isResolvedCategoryTaskView(appSessionStore.selectedTaskView) ||
      appSessionStore.selectedTaskView.categoryId !== categoryId
    ) {
      await selectCategory(categoryId)
    }
  }

  async function reorderTasks(previousOrderedIds: number[]) {
    const activeTarget = getActiveTaskTarget()
    if (!activeTarget || !isCurrentActiveTaskView()) return false

    return await taskStore.reorderTasks(previousOrderedIds, {
      persist: activeTarget.taskListView !== 'all'
    })
  }

  async function moveTaskToCategory(id: number, targetCategoryId: number) {
    if (!isCurrentActiveTaskView()) {
      return false
    }

    return await taskStore.moveTaskToCategory(id, targetCategoryId, {
      taskView: appSessionStore.selectedTaskView,
      scopeKey: currentTaskScopeKey.value
    })
  }

  async function toggleExpand(taskId: number) {
    const scopeKey = currentTaskScopeKey.value
    if (scopeKey === null || !isCurrentActiveTaskView()) return false

    return await subTaskStore.toggleExpand(taskId, scopeKey)
  }

  async function addSubTask(content: string, parentId: number) {
    if (!isCurrentActiveTaskView()) return false
    return await subTaskStore.addSubTask(content, parentId)
  }

  async function toggleSubTask(id: number, parentId: number) {
    if (!isCurrentActiveTaskView()) return false
    return await subTaskStore.toggleSubTask(id, parentId)
  }

  async function deleteSubTask(id: number, parentId: number) {
    const activeTarget = getActiveTaskTarget()
    if (!activeTarget || !isCurrentActiveTaskView()) return false

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
    if (!isCurrentActiveTaskView()) return false
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
    selectedTaskView,
    categories,
    currentCategoryId,
    activeTaskCategoryId,
    currentCategory,
    inboxCategory,
    inboxCategoryId,
    isArchiveTaskViewActive,
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
