import { DEFAULT_TASK_PRIORITY } from '../constants/task'
import {
  BACKUP_FORMAT,
  BACKUP_READER_VERSION,
  BACKUP_VERSION,
  type BackupArchivedTaskRecord,
  type BackupCategoryRecord,
  type BackupCompatibilityInfo,
  type BackupDataPayload,
  type BackupEnvelope,
  type BackupImportErrorCode,
  type BackupImportResult,
  type BackupTaskRecord
} from '../types/backup'
import { parseNullableTaskDuePrecision, parseTaskPriority } from './taskFields'
import {
  ContractError,
  expectArray,
  expectBoolean,
  expectInteger,
  expectRecord,
  expectString
} from './utils'

export class BackupCompatibilityError extends ContractError {
  constructor(
    public readonly code: 'UNSUPPORTED_BACKUP_FORMAT' | 'BACKUP_REQUIRES_NEWER_READER',
    message: string
  ) {
    super(message)
    this.name = 'BackupCompatibilityError'
  }
}

function parseOptionalInteger(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {}
): number | null {
  if (value === null || value === undefined) {
    return null
  }

  return expectInteger(value, label, options)
}

function parseOptionalString(
  value: unknown,
  label: string,
  options: { minLength?: number; maxLength?: number; trim?: boolean } = {}
): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return expectString(value, label, options)
}

function expectBackupKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  label: string
): void {
  for (const key of keys) {
    if (!(key in record)) {
      throw new ContractError(`${label}.${key} is required`)
    }
  }
}

function parseDueState(
  record: Record<string, unknown>,
  label: string
): Pick<BackupArchivedTaskRecord, 'due_at' | 'due_precision'> {
  const dueAt = parseOptionalInteger(record.due_at, `${label}.due_at`, { min: 0 })
  const duePrecision = parseNullableTaskDuePrecision(record.due_precision, `${label}.due_precision`)

  if ((dueAt === null) !== (duePrecision === null)) {
    throw new ContractError(`${label} must include due_at and due_precision together`)
  }

  return {
    due_at: dueAt,
    due_precision: duePrecision
  }
}

type BackupParseMode = 'legacy' | 'current'

function parseBackupCategory(
  value: unknown,
  label: string,
  mode: BackupParseMode
): BackupCategoryRecord {
  const record = expectRecord(value, label)
  if (mode === 'current') {
    expectBackupKeys(record, ['id', 'name', 'is_system', 'order_index', 'created_at'], label)
  }

  return {
    id: expectInteger(record.id, `${label}.id`, { min: 1 }),
    name: expectString(record.name, `${label}.name`, { trim: true, minLength: 1, maxLength: 64 }),
    is_system:
      record.is_system === undefined ? false : expectBoolean(record.is_system, `${label}.is_system`),
    order_index:
      record.order_index === undefined
        ? 0
        : expectInteger(record.order_index, `${label}.order_index`, { min: 0 }),
    created_at:
      record.created_at === undefined
        ? 0
        : expectInteger(record.created_at, `${label}.created_at`, { min: 0 })
  }
}

function parseBackupTaskRecord(
  value: unknown,
  label: string,
  mode: BackupParseMode
): BackupTaskRecord {
  const record = expectRecord(value, label)
  if (mode === 'current') {
    expectBackupKeys(
      record,
      [
        'id',
        'content',
        'is_completed',
        'category_id',
        'order_index',
        'created_at',
        'completed_at',
        'last_restored_at',
        'parent_id',
        'priority',
        'due_at',
        'due_precision'
      ],
      label
    )
  }

  return {
    id: expectInteger(record.id, `${label}.id`, { min: 1 }),
    content: expectString(record.content, `${label}.content`, {
      trim: true,
      minLength: 1,
      maxLength: 200
    }),
    is_completed:
      record.is_completed === undefined
        ? false
        : expectBoolean(record.is_completed, `${label}.is_completed`),
    category_id: expectInteger(record.category_id, `${label}.category_id`, { min: 1 }),
    order_index:
      record.order_index === undefined
        ? 0
        : expectInteger(record.order_index, `${label}.order_index`, { min: 0 }),
    created_at:
      record.created_at === undefined
        ? 0
        : expectInteger(record.created_at, `${label}.created_at`, { min: 0 }),
    completed_at: parseOptionalInteger(record.completed_at, `${label}.completed_at`, { min: 0 }),
    last_restored_at: parseOptionalInteger(record.last_restored_at, `${label}.last_restored_at`, {
      min: 0
    }),
    parent_id:
      record.parent_id === undefined
        ? null
        : parseOptionalInteger(record.parent_id, `${label}.parent_id`, { min: 1 }),
    priority: parseTaskPriority(record.priority ?? DEFAULT_TASK_PRIORITY, `${label}.priority`),
    ...parseDueState(record, label)
  }
}

function parseBackupTask(value: unknown, label: string, mode: BackupParseMode): BackupTaskRecord {
  return parseBackupTaskRecord(value, label, mode)
}

function parseBackupArchivedTask(
  value: unknown,
  label: string,
  mode: BackupParseMode
): BackupArchivedTaskRecord {
  const record = expectRecord(value, label)
  if (mode === 'current') {
    expectBackupKeys(record, ['archived_at', 'archived_category_name'], label)
  }
  const base = parseBackupTaskRecord(record, label, mode)

  return {
    ...base,
    is_completed:
      record.is_completed === undefined
        ? true
        : expectBoolean(record.is_completed, `${label}.is_completed`),
    archived_at:
      record.archived_at === undefined
        ? base.completed_at ?? base.created_at
        : expectInteger(record.archived_at, `${label}.archived_at`, { min: 0 }),
    archived_category_name: parseOptionalString(
      record.archived_category_name,
      `${label}.archived_category_name`,
      {
        trim: true,
        minLength: 1,
        maxLength: 64
      }
    )
  }
}

function parseBackupDataRecord(
  record: Record<string, unknown>,
  label: string,
  mode: BackupParseMode
): BackupDataPayload {
  if (mode === 'current') {
    expectBackupKeys(record, ['categories', 'tasks', 'archivedTasks'], label)
  }

  return {
    categories: expectArray(record.categories, `${label}.categories`, (item, itemLabel) =>
      parseBackupCategory(item, itemLabel, mode)
    ),
    tasks: expectArray(record.tasks, `${label}.tasks`, (item, itemLabel) =>
      parseBackupTask(item, itemLabel, mode)
    ),
    archivedTasks:
      record.archivedTasks === undefined
        ? []
        : expectArray(record.archivedTasks, `${label}.archivedTasks`, (item, itemLabel) =>
            parseBackupArchivedTask(item, itemLabel, mode)
          )
  }
}

function parseBackupCompatibility(
  record: Record<string, unknown>,
  version: number,
  label: string
): BackupCompatibilityInfo {
  if (record.compatibility === undefined) {
    if (version > BACKUP_VERSION) {
      throw new BackupCompatibilityError(
        'BACKUP_REQUIRES_NEWER_READER',
        `${label}.compatibility.minReaderVersion is required for backup version ${version}`
      )
    }

    throw new ContractError(`${label}.compatibility is required`)
  }

  const compatibility = expectRecord(record.compatibility, `${label}.compatibility`)

  return {
    minReaderVersion: expectInteger(
      compatibility.minReaderVersion,
      `${label}.compatibility.minReaderVersion`,
      {
        min: 1,
        max: Math.max(version, BACKUP_READER_VERSION)
      }
    )
  }
}

function parseBackupImportErrorCode(value: unknown, label: string): BackupImportErrorCode {
  const code = expectString(value, label, {
    trim: true,
    minLength: 1,
    maxLength: 64
  }) as BackupImportErrorCode

  const supportedCodes: BackupImportErrorCode[] = [
    'INVALID_FILE_TYPE',
    'FILE_TOO_LARGE',
    'FILE_READ_FAILED',
    'EMPTY_FILE',
    'INVALID_JSON',
    'UNSUPPORTED_BACKUP_FORMAT',
    'BACKUP_REQUIRES_NEWER_READER',
    'INVALID_BACKUP_PAYLOAD',
    'IMPORT_FAILED'
  ]

  if (!supportedCodes.includes(code)) {
    throw new ContractError(`${label} is not supported`)
  }

  return code
}

export function parseBackupEnvelope(value: unknown, label = 'backupEnvelope'): BackupEnvelope {
  const record = expectRecord(value, label)
  const format = expectString(record.format, `${label}.format`, {
    trim: true,
    minLength: 1,
    maxLength: 64
  })

  if (format !== BACKUP_FORMAT) {
    throw new BackupCompatibilityError(
      'UNSUPPORTED_BACKUP_FORMAT',
      `${label}.format is not supported`
    )
  }

  const version = expectInteger(record.version, `${label}.version`, { min: 1 })
  const compatibility = parseBackupCompatibility(record, version, label)

  if (compatibility.minReaderVersion > BACKUP_READER_VERSION) {
    throw new BackupCompatibilityError(
      'BACKUP_REQUIRES_NEWER_READER',
      `${label} requires reader version ${compatibility.minReaderVersion}, current reader is ${BACKUP_READER_VERSION}`
    )
  }

  return {
    format: BACKUP_FORMAT,
    version,
    compatibility,
    exportedAt: expectString(record.exportedAt, `${label}.exportedAt`, {
      trim: true,
      minLength: 1,
      maxLength: 128
    }),
    appVersion: expectString(record.appVersion, `${label}.appVersion`, {
      trim: true,
      minLength: 1,
      maxLength: 64
    }),
    data: parseBackupDataRecord(expectRecord(record.data, `${label}.data`), `${label}.data`, 'current')
  }
}

export function parseBackupImportPayload(value: unknown, label = 'backupImport'): BackupDataPayload {
  const record = expectRecord(value, label)

  if ('format' in record || 'version' in record || 'data' in record) {
    return parseBackupEnvelope(record, label).data
  }

  return parseBackupDataRecord(record, label, 'legacy')
}

export function parseBackupImportResult(value: unknown, label = 'backupImportResult'): BackupImportResult {
  const record = expectRecord(value, label)
  const status = expectString(record.status, `${label}.status`, { trim: true, minLength: 1 })

  if (status === 'cancelled') {
    return { status }
  }

  if (status === 'success') {
    const summary = expectRecord(record.summary, `${label}.summary`)

    return {
      status,
      summary: {
        categories: expectInteger(summary.categories, `${label}.summary.categories`, { min: 0 }),
        tasks: expectInteger(summary.tasks, `${label}.summary.tasks`, { min: 0 }),
        archivedTasks: expectInteger(summary.archivedTasks, `${label}.summary.archivedTasks`, {
          min: 0
        })
      }
    }
  }

  if (status === 'error') {
    const error = expectRecord(record.error, `${label}.error`)

    return {
      status,
      error: {
        code: parseBackupImportErrorCode(error.code, `${label}.error.code`),
        message: expectString(error.message, `${label}.error.message`, {
          trim: true,
          minLength: 1,
          maxLength: 200
        })
      }
    }
  }

  throw new ContractError(`${label}.status is not supported`)
}

export function buildBackupEnvelope(
  data: BackupDataPayload,
  appVersion: string,
  exportedAt = new Date().toISOString()
): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    compatibility: {
      minReaderVersion: BACKUP_READER_VERSION
    },
    exportedAt,
    appVersion: expectString(appVersion, 'backupEnvelope.appVersion', {
      trim: true,
      minLength: 1,
      maxLength: 64
    }),
    data
  }
}
