import { useCategoryStore } from './category'
import { useTaskStore } from './task'
import { useSubTaskStore } from './subtask'

/**
 * 统一协调入口：聚合三个业务域子 store 并暴露兼容原有调用方的接口。
 *
 * 外部组件继续 `import { store } from '../store'` 即可，无需感知内部拆分。
 * 各 useXxxStore() 在函数体内按需调用（Pinia 要求在 setup 上下文内调用，
 * 聚合层的方法在运行时调用时 pinia 实例已初始化，因此此处可安全调用）。
 */
export const store = {
  // ─── Category ───────────────────────────────────────────────
  get categories() {
    return useCategoryStore().categories
  },
  get currentCategoryId() {
    return useCategoryStore().currentCategoryId
  },

  // ─── Task ───────────────────────────────────────────────────
  get tasks() {
    return useTaskStore().tasks
  },
  get isLoading() {
    return useTaskStore().isLoading
  },
  get pendingCounts() {
    return useTaskStore().pendingCounts
  },

  // ─── SubTask ────────────────────────────────────────────────
  get subTasksMap() {
    return useSubTaskStore().subTasksMap
  },
  get expandedTaskIds() {
    return useSubTaskStore().expandedTaskIds
  },

  // ─── Category Actions ────────────────────────────────────────
  async fetchCategories() {
    const categoryStore = useCategoryStore()
    const taskStore = useTaskStore()
    await categoryStore.fetchCategories()
    await taskStore.initPendingCounts()
    if (categoryStore.currentCategoryId) {
      await this.fetchTasks()
    }
  },

  async addCategory(name: string) {
    await useCategoryStore().addCategory(name)
    if (useCategoryStore().currentCategoryId) {
      await this.fetchTasks()
    }
  },

  async deleteCategory(id: number) {
    useTaskStore().removePendingCount(id)
    await useCategoryStore().deleteCategory(id)
    if (useCategoryStore().currentCategoryId) {
      await this.fetchTasks()
    } else {
      useTaskStore().clearTasks()
    }
  },

  async updateCategory(id: number, name: string) {
    await useCategoryStore().updateCategory(id, name)
  },

  async selectCategory(id: number) {
    useCategoryStore().selectCategory(id)
    useSubTaskStore().reset()
    await this.fetchTasks()
  },

  // ─── Task Actions ────────────────────────────────────────────
  async fetchTasks() {
    const categoryId = useCategoryStore().currentCategoryId
    const taskStore = useTaskStore()
    const subTaskStore = useSubTaskStore()
    if (!categoryId) {
      taskStore.clearTasks()
      return
    }
    await taskStore.fetchTasks(categoryId)
    subTaskStore.loadExpandedForCategory(categoryId)
    await subTaskStore.fetchExpandedSubTasks(subTaskStore.expandedTaskIds)
  },

  async addTask(content: string) {
    const categoryId = useCategoryStore().currentCategoryId
    if (!categoryId) return
    await useTaskStore().addTask(content, categoryId)
  },

  async toggleTask(id: number) {
    const categoryId = useCategoryStore().currentCategoryId
    if (!categoryId) return
    await useTaskStore().toggleTask(id, categoryId)
  },

  async deleteTask(id: number) {
    const categoryId = useCategoryStore().currentCategoryId
    if (!categoryId) return
    await useTaskStore().deleteTask(id, categoryId)
    useSubTaskStore().removeTask(id, categoryId)
  },

  async updateTaskContent(id: number, content: string) {
    await useTaskStore().updateTaskContent(id, content)
  },

  async clearCompletedTasks() {
    const categoryId = useCategoryStore().currentCategoryId
    const completedIds = await useTaskStore().clearCompletedTasks()
    if (completedIds && categoryId) {
      useSubTaskStore().removeCompletedTasks(completedIds, categoryId)
    }
  },

  // ─── SubTask Actions ─────────────────────────────────────────
  async fetchSubTasks(parentId: number) {
    await useSubTaskStore().fetchSubTasks(parentId)
  },

  async toggleExpand(taskId: number) {
    const categoryId = useCategoryStore().currentCategoryId
    if (!categoryId) return
    await useSubTaskStore().toggleExpand(taskId, categoryId)
  },

  async addSubTask(content: string, parentId: number) {
    await useSubTaskStore().addSubTask(content, parentId)
  },

  async toggleSubTask(id: number, parentId: number) {
    await useSubTaskStore().toggleSubTask(id, parentId)
  },

  async deleteSubTask(id: number, parentId: number) {
    await useSubTaskStore().deleteSubTask(id, parentId)
  },

  async updateSubTaskContent(id: number, parentId: number, content: string) {
    await useSubTaskStore().updateSubTaskContent(id, parentId, content)
  }
}
