import { categoryStore } from './category'
import { taskStore } from './task'
import { subTaskStore } from './subtask'

/**
 * 统一协调入口：聚合三个业务域子 store 并暴露兼容原有调用方的接口。
 *
 * 外部组件继续 `import { store } from '../store'` 即可，无需感知内部拆分。
 */
export const store = {
  // ─── Category ───────────────────────────────────────────────
  get categories() {
    return categoryStore.categories
  },
  get currentCategoryId() {
    return categoryStore.currentCategoryId
  },

  // ─── Task ───────────────────────────────────────────────────
  get tasks() {
    return taskStore.tasks
  },
  get isLoading() {
    return taskStore.isLoading
  },
  get pendingCounts() {
    return taskStore.pendingCounts
  },

  // ─── SubTask ────────────────────────────────────────────────
  get subTasksMap() {
    return subTaskStore.subTasksMap
  },
  get expandedTaskIds() {
    return subTaskStore.expandedTaskIds
  },

  // ─── Category Actions ────────────────────────────────────────
  async fetchCategories() {
    await categoryStore.fetchCategories()
    await taskStore.initPendingCounts()
    if (categoryStore.currentCategoryId) {
      await this.fetchTasks()
    }
  },

  async addCategory(name: string) {
    await categoryStore.addCategory(name)
    if (categoryStore.currentCategoryId) {
      await this.fetchTasks()
    }
  },

  async deleteCategory(id: number) {
    taskStore.removePendingCount(id)
    await categoryStore.deleteCategory(id)
    if (categoryStore.currentCategoryId) {
      await this.fetchTasks()
    } else {
      taskStore.clearTasks()
    }
  },

  /** @forwarding 纯转发，调用方也可直接 import { categoryStore } */
  async updateCategory(id: number, name: string) {
    await categoryStore.updateCategory(id, name)
  },

  async selectCategory(id: number) {
    categoryStore.selectCategory(id)
    subTaskStore.reset()
    await this.fetchTasks()
  },

  // ─── Task Actions ────────────────────────────────────────────
  async fetchTasks() {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) {
      taskStore.clearTasks()
      return
    }
    await taskStore.fetchTasks(categoryId)
    subTaskStore.loadExpandedForCategory(categoryId)
    await subTaskStore.fetchExpandedSubTasks(subTaskStore.expandedTaskIds)
  },

  async addTask(content: string) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return
    await taskStore.addTask(content, categoryId)
  },

  async toggleTask(id: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return
    await taskStore.toggleTask(id, categoryId)
  },

  async deleteTask(id: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return
    await taskStore.deleteTask(id, categoryId)
    subTaskStore.removeTask(id, categoryId)
  },

  /** @forwarding 纯转发，调用方也可直接 import { taskStore } */
  async updateTaskContent(id: number, content: string) {
    await taskStore.updateTaskContent(id, content)
  },

  async clearCompletedTasks() {
    const categoryId = categoryStore.currentCategoryId
    const completedIds = await taskStore.clearCompletedTasks()
    if (completedIds && categoryId) {
      subTaskStore.removeCompletedTasks(completedIds, categoryId)
    }
  },

  // ─── SubTask Actions ─────────────────────────────────────────
  /** @forwarding 纯转发，调用方也可直接 import { subTaskStore } */
  async fetchSubTasks(parentId: number) {
    await subTaskStore.fetchSubTasks(parentId)
  },

  async toggleExpand(taskId: number) {
    const categoryId = categoryStore.currentCategoryId
    if (!categoryId) return
    await subTaskStore.toggleExpand(taskId, categoryId)
  },

  async addSubTask(content: string, parentId: number) {
    await subTaskStore.addSubTask(content, parentId)
  },

  async toggleSubTask(id: number, parentId: number) {
    await subTaskStore.toggleSubTask(id, parentId)
  },

  async deleteSubTask(id: number, parentId: number) {
    await subTaskStore.deleteSubTask(id, parentId)
  },

  /** @forwarding 纯转发，调用方也可直接 import { subTaskStore } */
  async updateSubTaskContent(id: number, parentId: number, content: string) {
    await subTaskStore.updateSubTaskContent(id, parentId, content)
  }
}
