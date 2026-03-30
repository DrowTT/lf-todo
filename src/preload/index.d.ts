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

interface AutoCleanupConfig {
  enabled: boolean
  days: number
}

interface SettingsData {
  autoLaunch: boolean
  closeToTray: boolean
  autoCleanup: AutoCleanupConfig
}

interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
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
    onUpdateStatus: (callback: (data: UpdateStatusData) => void) => void
  }
  auth: {
    saveTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<boolean>
    getTokens: () => Promise<{ accessToken: string; refreshToken: string } | null>
    clearTokens: () => Promise<boolean>
    getDeviceInfo: () => Promise<{ deviceId: string; deviceName: string }>
  }
}

/** 更新状态数据类型 */
type UpdateStatusData =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
