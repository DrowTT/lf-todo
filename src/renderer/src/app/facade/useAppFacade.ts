import { storeToRefs } from 'pinia'
import { useCategoryStore } from '../../store/category'
import { useSubTaskStore } from '../../store/subtask'
import { useTaskStore } from '../../store/task'

export function useAppFacade() {
  const categoryStore = useCategoryStore()
  const taskStore = useTaskStore()
  const subTaskStore = useSubTaskStore()
  let latestTaskRequestId = 0

  const { categories, currentCategoryId } = storeToRefs(categoryStore)
  const { tasks, isLoading, pendingCounts } = storeToRefs(taskStore)
  const { subTasksMap, expandedTaskIds } = storeToRefs(subTaskStore)

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

    if (requestId !== latestTaskRequestId || categoryStore.currentCategoryId !== categoryId) {
      return
    }
  }

  async function addTask(content: string) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return false

    return await taskStore.addTask(content, categoryId)
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

    if (deleted) {
      subTaskStore.removeTask(id, categoryId)
    }

    return deleted
  }

  async function updateTaskContent(id: number, content: string) {
    return await taskStore.updateTaskContent(id, content)
  }

  async function clearCompletedTasks() {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return undefined

    const completedIds = await taskStore.clearCompletedTasks(categoryId)

    if (completedIds) {
      subTaskStore.removeCompletedTasks(completedIds, categoryId)
    }

    return completedIds
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
    return await subTaskStore.deleteSubTask(id, parentId)
  }

  async function updateSubTaskContent(id: number, parentId: number, content: string) {
    return await subTaskStore.updateSubTaskContent(id, parentId, content)
  }

  return {
    categoryStore,
    taskStore,
    subTaskStore,
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
