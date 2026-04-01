import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppInfo,
  AutoCleanupConfig,
  Category,
  SettingsData,
  Task,
  UpdateStatusData
} from '../shared/types/models'

interface API {
  window: {
    minimize: () => void
    close: () => void
    toggleAlwaysOnTop: () => void
    toggleMaximize: () => void
    onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => () => void
    onMaximizedChanged: (callback: (flag: boolean) => void) => () => void
  }
  db: {
    getCategories: () => Promise<Category[]>
    createCategory: (name: string) => Promise<Category>
    updateCategory: (id: number, name: string) => Promise<void>
    deleteCategory: (id: number) => Promise<void>
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
    clearCompletedTasks: (categoryId: number) => Promise<number>
    reorderTasks: (orderedIds: number[]) => Promise<void>
    getSubTasks: (parentId: number) => Promise<Task[]>
    createSubTask: (content: string, parentId: number) => Promise<Task>
    batchCompleteSubTasks: (parentId: number) => Promise<number>
  }
  settings: {
    getAll: () => Promise<SettingsData>
    setAutoLaunch: (enabled: boolean) => Promise<boolean>
    setCloseToTray: (enabled: boolean) => Promise<boolean>
    setAutoCleanup: (config: AutoCleanupConfig) => Promise<AutoCleanupConfig>
    exportData: () => Promise<boolean>
    getAppInfo: () => Promise<AppInfo>
  }
  updater: {
    checkForUpdates: () => Promise<void>
    downloadUpdate: () => Promise<void>
    installUpdate: () => Promise<void>
    onUpdateStatus: (callback: (data: UpdateStatusData) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
