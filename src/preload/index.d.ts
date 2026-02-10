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
  is_completed: number
  category_id: number
  order_index: number
  created_at: number
}

interface API {
  window: {
    minimize: () => void
    close: () => void
    toggleAlwaysOnTop: () => void
    onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => void
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
    updateTask: (id: number, updates: any) => Promise<void>
    deleteTask: (id: number) => Promise<void>
    toggleTaskComplete: (id: number) => Promise<void>
    getPendingTaskCounts: () => Promise<Record<number, number>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
