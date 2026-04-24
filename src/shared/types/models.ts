export interface Category {
  id: number
  name: string
  is_system: boolean
  order_index: number
  created_at: number
}

export type TaskDuePrecision = 'date' | 'datetime'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface TaskDueState {
  due_at: number | null
  due_precision: TaskDuePrecision | null
}

export interface Task {
  id: number
  content: string
  description: string | null
  is_completed: boolean
  category_id: number
  order_index: number
  created_at: number
  completed_at: number | null
  last_restored_at: number | null
  parent_id: number | null
  due_at: number | null
  due_precision: TaskDuePrecision | null
  priority: TaskPriority
  archived_at?: number | null
  archived_category_name?: string | null
  subtask_total: number
  subtask_done: number
  search_subtask_matches?: string[]
}

export interface ArchivedTaskGroup {
  task: Task
  subTasks: Task[]
}

export interface TaskCreateInput extends TaskDueState {
  content: string
  categoryId: number
  priority: TaskPriority
}

export interface QuickAddSubmitInput {
  content: string
  categoryId: number | null
  categoryName: string | null
}

export interface QuickAddSubmitResult {
  task: Task
  category: Category
  categoryCreated: boolean
}

export interface QuickAddCommittedEvent {
  categoryId: number
  categoryCreated: boolean
}

export type TaskUpdate = Partial<
  Pick<
    Task,
    | 'content'
    | 'description'
    | 'is_completed'
    | 'order_index'
    | 'due_at'
    | 'due_precision'
    | 'priority'
  >
>

export interface AutoCleanupConfig {
  enabled: boolean
  days: number
}

export interface PomodoroTaskBinding {
  taskId: number | null
  taskContentSnapshot: string | null
}

export interface PomodoroSessionState extends PomodoroTaskBinding {
  startedAt: number
  endsAt: number
  durationSeconds: number
  source: 'global' | 'task'
}

export interface PomodoroRecord extends PomodoroTaskBinding {
  id: string
  completedAt: number
  durationSeconds: number
  source: 'global' | 'task'
}

export interface PomodoroData {
  focusDurationSeconds: number
  totalCompletedCount: number
  activeSession: PomodoroSessionState | null
  history: PomodoroRecord[]
}

export interface SettingsData {
  autoLaunch: boolean
  closeToTray: boolean
  autoCleanup: AutoCleanupConfig
  pomodoro: PomodoroData
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
