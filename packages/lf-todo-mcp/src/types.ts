export const DEFAULT_TASK_PRIORITY = 'medium' as const

export type TaskDuePrecision = 'date' | 'datetime'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface BackupCategoryRecord {
  id: number
  name: string
  is_system: boolean
  order_index: number
  created_at: number
}

export interface BackupTaskRecord {
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
}

export interface BackupArchivedTaskRecord extends BackupTaskRecord {
  archived_at: number
  archived_category_name: string | null
}

export interface BackupDataPayload {
  categories: BackupCategoryRecord[]
  tasks: BackupTaskRecord[]
  archivedTasks: BackupArchivedTaskRecord[]
}

export type TaskUpdate = Partial<{
  content: string
  description: string | null
  is_completed: boolean
  order_index: number
  due_at: number | null
  due_precision: TaskDuePrecision | null
  priority: TaskPriority
}>
