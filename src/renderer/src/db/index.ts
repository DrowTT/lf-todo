/**
 * SQLite 数据库封装层 - 渲染进程侧类型定义
 */

export interface Category {
  id: number
  name: string
  order_index: number
  created_at: number
}

export interface Task {
  id: number
  content: string
  is_completed: number
  category_id: number
  order_index: number
  created_at: number
}

// 数据库 API 代理（从 window.api.db）
export const db = {
  // Category 操作
  getCategories: () => window.api.db.getCategories() as Promise<Category[]>,
  createCategory: (name: string) => window.api.db.createCategory(name) as Promise<Category>,
  updateCategory: (id: number, name: string) =>
    window.api.db.updateCategory(id, name) as Promise<void>,
  deleteCategory: (id: number) => window.api.db.deleteCategory(id) as Promise<void>,

  // Task 操作
  getTasks: (categoryId: number) => window.api.db.getTasks(categoryId) as Promise<Task[]>,
  createTask: (content: string, categoryId: number) =>
    window.api.db.createTask(content, categoryId) as Promise<Task>,
  updateTask: (id: number, updates: Partial<Task>) =>
    window.api.db.updateTask(id, updates) as Promise<void>,
  deleteTask: (id: number) => window.api.db.deleteTask(id) as Promise<void>,
  toggleTaskComplete: (id: number) => window.api.db.toggleTaskComplete(id) as Promise<void>,
  getPendingTaskCounts: () =>
    window.api.db.getPendingTaskCounts() as Promise<Record<number, number>>
}
