import { ElectronAPI } from '@electron-toolkit/preload'

interface Category {
  id: number
  name: string
  order_index: number
  created_at: number
}

interface Task {
  id: number
  content: string
  is_completed: boolean
  category_id: number
  order_index: number
  created_at: number
  parent_id: number | null
  subtask_total: number
  subtask_done: number
}

interface API {
  window: {
    minimize: () => void
    close: () => void
    toggleAlwaysOnTop: () => void
    toggleMaximize: () => void
    onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => void
    onMaximizedChanged: (callback: (flag: boolean) => void) => void
  }
  db: {
    // Category 操作
    getCategories: () => Promise<Category[]>
    createCategory: (name: string) => Promise<Category>
    updateCategory: (id: number, name: string) => Promise<void>
    deleteCategory: (id: number) => Promise<void>

    // Task 操作
    getTasks: (categoryId: number) => Promise<Task[]>
    createTask: (content: string, categoryId: number) => Promise<Task>
    updateTask: (
      id: number,
      updates: Partial<Pick<Task, 'content' | 'is_completed' | 'order_index'>>
    ) => Promise<void>
    deleteTask: (id: number) => Promise<void>
    deleteTasks: (ids: number[]) => Promise<void>
    toggleTaskComplete: (id: number) => Promise<void>
    setTaskCompleted: (id: number, completed: boolean) => Promise<void>
    getPendingTaskCounts: () => Promise<Record<number, number>>
    reorderTasks: (orderedIds: number[]) => Promise<void>

    // SubTask 操作
    getSubTasks: (parentId: number) => Promise<Task[]>
    createSubTask: (content: string, parentId: number) => Promise<Task>
    batchCompleteSubTasks: (parentId: number) => Promise<number>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
