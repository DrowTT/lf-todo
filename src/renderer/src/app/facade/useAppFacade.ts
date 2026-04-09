import { storeToRefs } from 'pinia'
import type { TaskDueState } from '../../../../shared/types/models'
import { useCategoryStore } from '../../store/category'
import { useSubTaskStore } from '../../store/subtask'
import { useTaskStore } from '../../store/task'
import { useUndoStore } from '../../store/undo'

const UNDO_LABEL = '撤销'

export function useAppFacade() {
  const categoryStore = useCategoryStore()
  const taskStore = useTaskStore()
  const subTaskStore = useSubTaskStore()
  const undoStore = useUndoStore()
  let latestTaskRequestId = 0

  const { categories, currentCategoryId } = storeToRefs(categoryStore)
  const { tasks, isLoading, pendingCounts } = storeToRefs(taskStore)
  const { subTasksMap, expandedTaskIds } = storeToRefs(subTaskStore)

  function registerUndo(text: string, undo: () => Promise<boolean>) {
    undoStore.register({
      label: UNDO_LABEL,
      text,
      undo
    })
  }

  async function ensureCategoryReady(categoryId: number) {
    if (categoryStore.currentCategoryId === categoryId) return
    await selectCategory(categoryId)
  }

  async function fetchCategories() {
    const hasCurrentCategory = await categoryStore.fetchCategories()
    await taskStore.initPendingCounts()

    if (hasCurrentCategory && categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
      return
    }

    taskStore.clearTasks()
    subTaskStore.reset()
  }

  async function addCategory(name: string) {
    await categoryStore.addCategory(name)

    if (categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
    }
  }

  async function deleteCategory(id: number) {
    taskStore.removePendingCount(id)
    await categoryStore.deleteCategory(id)

    if (categoryStore.currentCategoryId) {
      await fetchTasks(categoryStore.currentCategoryId)
      return
    }

    taskStore.clearTasks()
    subTaskStore.reset()
  }

  async function updateCategory(id: number, name: string) {
    await categoryStore.updateCategory(id, name)
  }

  async function selectCategory(id: number) {
    categoryStore.selectCategory(id)
    subTaskStore.reset()
    await fetchTasks(id)
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

  async function addTask(content: string, dueState?: TaskDueState) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return false

    return await taskStore.addTask(content, categoryId, dueState)
  }

  async function toggleTask(id: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return false

    return await taskStore.toggleTask(id, categoryId)
  }

  async function deleteTask(id: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return false

    const deleted = await taskStore.deleteTask(id, categoryId)
    if (!deleted) return false

    subTaskStore.removeTask(id, categoryId)

    registerUndo('任务已删除', async () => {
      await ensureCategoryReady(deleted.task.category_id)
      await taskStore.restoreDeletedTask(deleted)
      return true
    })

    return deleted
  }

  async function updateTaskContent(id: number, content: string) {
    return await taskStore.updateTaskContent(id, content)
  }

  async function clearCompletedTasks() {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return undefined

    const deleted = await taskStore.clearCompletedTasks(categoryId)
    if (!deleted) return undefined

    subTaskStore.removeCompletedTasks(
      deleted.tasks.map((task) => task.task.id),
      categoryId
    )

    registerUndo(`已清空 ${deleted.tasks.length} 个已完成任务`, async () => {
      await ensureCategoryReady(deleted.categoryId)
      await taskStore.restoreClearedCompleted(deleted)
      return true
    })

    return deleted
  }

  async function reorderTasks(previousOrderedIds: number[]) {
    return await taskStore.reorderTasks(previousOrderedIds)
  }

  async function toggleExpand(taskId: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return false

    return await subTaskStore.toggleExpand(taskId, categoryId)
  }

  async function addSubTask(content: string, parentId: number) {
    return await subTaskStore.addSubTask(content, parentId)
  }

  async function toggleSubTask(id: number, parentId: number) {
    return await subTaskStore.toggleSubTask(id, parentId)
  }

  async function deleteSubTask(id: number, parentId: number) {
    const deleted = await subTaskStore.deleteSubTask(id, parentId)
    if (!deleted) return false

    registerUndo('子任务已删除', async () => {
      const categoryId =
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
    return await subTaskStore.updateSubTaskContent(id, parentId, content)
  }

  return {
    categoryStore,
    taskStore,
    subTaskStore,
    undoStore,
    categories,
    currentCategoryId,
    tasks,
    isLoading,
    pendingCounts,
    subTasksMap,
    expandedTaskIds,
    fetchCategories,
    addCategory,
    deleteCategory,
    updateCategory,
    selectCategory,
    fetchTasks,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskContent,
    clearCompletedTasks,
    reorderTasks,
    toggleExpand,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    updateSubTaskContent
  }
}
