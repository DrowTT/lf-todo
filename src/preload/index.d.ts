import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppInfo,
  AutoCleanupConfig,
  Category,
  PomodoroData,
  PomodoroSessionState,
  SettingsData,
  Task,
  UpdateStatusData
} from '../shared/types/models'

interface API {
  window: {
    minimize: () => void
    close: () => void
    quit: () => void
    toggleAlwaysOnTop: () => void
    toggleMaximize: () => void
    onQuitRequested: (callback: () => void) => () => void
    onFocusMainInputRequested: (callback: () => void) => () => void
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
    setPomodoroFocusDuration: (durationSeconds: number) => Promise<number>
    setPomodoroActiveSession: (
      session: PomodoroSessionState | null
    ) => Promise<PomodoroSessionState | null>
    completePomodoroSession: (session: PomodoroSessionState) => Promise<PomodoroData>
    setGlobalHotkeys: (
      config: Record<'showWindow' | 'showWindowAndFocusInput', { key: string; label: string }>
    ) => Promise<void>
    notifyPomodoroCompleted: (durationSeconds: number) => Promise<void>
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
