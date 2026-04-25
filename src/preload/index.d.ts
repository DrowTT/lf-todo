import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ArchivedTaskGroup,
  AppInfo,
  AutoCleanupConfig,
  Category,
  PomodoroData,
  PomodoroSessionState,
  QuickAddCommittedEvent,
  QuickAddSubmitInput,
  QuickAddSubmitResult,
  SettingsData,
  Task,
  TaskCreateInput,
  TaskUpdate,
  UpdateStatusData
} from '../shared/types/models'
import type { BackupImportResult } from '../shared/types/backup'

interface API {
  window: {
    minimize: () => void
    close: () => void
    hideToTray: () => void
    quit: () => void
    toggleAlwaysOnTop: () => void
    toggleMaximize: () => void
    resizeQuickAddWindow: (height: number) => void
    onQuitRequested: (callback: () => void) => () => void
    onFocusMainInputRequested: (callback: () => void) => () => void
    onFocusQuickAddInputRequested: (callback: () => void) => () => void
    onQuickAddSessionRequested: (callback: () => void) => () => void
    onQuickAddCommitted: (callback: (payload: QuickAddCommittedEvent) => void) => () => void
    onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => () => void
    onMaximizedChanged: (callback: (flag: boolean) => void) => () => void
  }
  db: {
    getCategories: () => Promise<Category[]>
    createCategory: (name: string) => Promise<Category>
    updateCategory: (id: number, name: string) => Promise<void>
    deleteCategory: (id: number) => Promise<void>
    getTasks: (categoryId: number) => Promise<Task[]>
    getAllTasks: () => Promise<Task[]>
    getArchivedTaskGroups: () => Promise<ArchivedTaskGroup[]>
    searchTasks: (input: {
      query: string
      categoryId?: number | null
      limit?: number
    }) => Promise<Task[]>
    createTask: (input: TaskCreateInput) => Promise<Task>
    updateTask: (id: number, updates: TaskUpdate) => Promise<void>
    moveTaskToCategory: (id: number, targetCategoryId: number) => Promise<void>
    deleteTask: (id: number) => Promise<void>
    toggleTaskComplete: (id: number) => Promise<void>
    setTaskCompleted: (id: number, completed: boolean) => Promise<void>
    getPendingTaskCounts: () => Promise<Record<number, number>>
    archiveCompletedTasks: (categoryId: number) => Promise<number>
    archiveAllCompletedTasks: () => Promise<number>
    archiveCompletedTaskIds: (ids: number[]) => Promise<number>
    archiveTask: (id: number) => Promise<void>
    restoreArchivedTasks: (ids: number[]) => Promise<number>
    reorderTasks: (orderedIds: number[]) => Promise<void>
    reorderSubTasks: (orderedIds: number[]) => Promise<void>
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
    importData: () => Promise<BackupImportResult>
    mergeData: () => Promise<BackupImportResult>
    exportData: () => Promise<boolean>
    getAppInfo: () => Promise<AppInfo>
  }
  quickAdd: {
    submit: (input: QuickAddSubmitInput) => Promise<QuickAddSubmitResult>
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
