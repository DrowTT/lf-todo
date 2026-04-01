export interface Category {
  id: number
  name: string
  order_index: number
  created_at: number
}

export interface Task {
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

export type TaskUpdate = Partial<Pick<Task, 'content' | 'is_completed' | 'order_index'>>

export interface AutoCleanupConfig {
  enabled: boolean
  days: number
}

export interface SettingsData {
  autoLaunch: boolean
  closeToTray: boolean
  autoCleanup: AutoCleanupConfig
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
}

export type UpdateStatusData =
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string }
  | { status: 'not-available' }
  | {
      status: 'downloading'
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
