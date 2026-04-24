import type { TaskDuePrecision, TaskPriority } from './models'

export const BACKUP_FORMAT = 'lf-todo-backup' as const
export const BACKUP_VERSION = 1 as const
export const BACKUP_READER_VERSION = 1 as const

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

export interface BackupCompatibilityInfo {
  minReaderVersion: number
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT
  version: number
  compatibility: BackupCompatibilityInfo
  exportedAt: string
  appVersion: string
  data: BackupDataPayload
}

export interface BackupImportSummary {
  categories: number
  tasks: number
  archivedTasks: number
}

export type BackupImportErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_READ_FAILED'
  | 'EMPTY_FILE'
  | 'INVALID_JSON'
  | 'UNSUPPORTED_BACKUP_FORMAT'
  | 'BACKUP_REQUIRES_NEWER_READER'
  | 'INVALID_BACKUP_PAYLOAD'
  | 'IMPORT_FAILED'

export type BackupImportResult =
  | { status: 'cancelled' }
  | { status: 'success'; summary: BackupImportSummary }
  | {
      status: 'error'
      error: {
        code: BackupImportErrorCode
        message: string
      }
    }
