import type { BackupDataPayload } from './types.js'

const BACKUP_FORMAT = 'lf-todo-backup' as const
const BACKUP_VERSION = 1
const BACKUP_READER_VERSION = 1

export function buildBackupEnvelope(
  data: BackupDataPayload,
  appVersion: string,
  exportedAt = new Date().toISOString()
): Record<string, unknown> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    compatibility: {
      minReaderVersion: BACKUP_READER_VERSION
    },
    exportedAt,
    appVersion,
    data
  }
}
