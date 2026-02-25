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
  is_completed: boolean // 在代理层统一 normalize，业务层无需关心 SQLite 的 0/1
  category_id: number
  order_index: number
  created_at: number
  parent_id: number | null
  subtask_total: number
  subtask_done: number
}

// 主进程 mapTask 出口已完成 is_completed 的 boolean 映射（SQLite 0/1 → boolean），
// IPC structuredClone 序列化不会将 boolean 还原为 0/1，renderer 侧无需再次 normalize。

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
  deleteTasks: (ids: number[]) => window.api.db.deleteTasks(ids) as Promise<void>,
  toggleTaskComplete: (id: number) => window.api.db.toggleTaskComplete(id) as Promise<void>,
  getPendingTaskCounts: () =>
    window.api.db.getPendingTaskCounts() as Promise<Record<number, number>>,

  // SubTask 操作
  getSubTasks: (parentId: number) => window.api.db.getSubTasks(parentId) as Promise<Task[]>,
  createSubTask: (content: string, parentId: number) =>
    window.api.db.createSubTask(content, parentId) as Promise<Task>
}
