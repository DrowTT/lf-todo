import type {
  AppInfo,
  AutoCleanupConfig,
  Category,
  PomodoroData,
  PomodoroRecord,
  PomodoroSessionState,
  QuickAddCommittedEvent,
  QuickAddSubmitResult,
  SettingsData,
  Task,
  TaskDuePrecision,
  TaskPriority,
  UpdateStatusData
} from '../types/models'
import { DEFAULT_TASK_PRIORITY, TASK_PRIORITY_VALUES } from '../constants/task'
import {
  assertAllowedKeys,
  expectArray,
  expectBoolean,
  expectInteger,
  expectRecord,
  expectString
} from './utils'

export function parseCategory(value: unknown, label = 'category'): Category {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['id', 'name', 'order_index', 'created_at'], label)

  return {
    id: expectInteger(record.id, `${label}.id`, { min: 1 }),
    name: expectString(record.name, `${label}.name`, { trim: true, minLength: 1, maxLength: 64 }),
    order_index: expectInteger(record.order_index, `${label}.order_index`, { min: 0 }),
    created_at: expectInteger(record.created_at, `${label}.created_at`, { min: 0 })
  }
}

export function parseCategories(value: unknown, label = 'categories'): Category[] {
  return expectArray(value, label, parseCategory)
}

export function parseTask(value: unknown, label = 'task'): Task {
  const record = expectRecord(value, label)
  assertAllowedKeys(
    record,
    [
      'id',
      'content',
      'is_completed',
      'category_id',
      'order_index',
      'created_at',
      'parent_id',
      'due_at',
      'due_precision',
      'priority',
      'subtask_total',
      'subtask_done'
    ],
    label
  )

  const dueAt =
    record.due_at === null || record.due_at === undefined
      ? null
      : expectInteger(record.due_at, `${label}.due_at`, { min: 0 })
  const duePrecision = parseTaskDuePrecision(record.due_precision, `${label}.due_precision`)

  if ((dueAt === null) !== (duePrecision === null)) {
    throw new Error(`${label} must include due_at and due_precision together`)
  }

  return {
    id: expectInteger(record.id, `${label}.id`, { min: 1 }),
    content: expectString(record.content, `${label}.content`, {
      trim: true,
      minLength: 1,
      maxLength: 200
    }),
    is_completed: expectBoolean(record.is_completed, `${label}.is_completed`),
    category_id: expectInteger(record.category_id, `${label}.category_id`, { min: 1 }),
    order_index: expectInteger(record.order_index, `${label}.order_index`, { min: 0 }),
    created_at: expectInteger(record.created_at, `${label}.created_at`, { min: 0 }),
    parent_id:
      record.parent_id === null
        ? null
        : expectInteger(record.parent_id, `${label}.parent_id`, { min: 1 }),
    due_at: dueAt,
    due_precision: duePrecision,
    priority: parseTaskPriority(record.priority, `${label}.priority`),
    subtask_total: expectInteger(record.subtask_total, `${label}.subtask_total`, { min: 0 }),
    subtask_done: expectInteger(record.subtask_done, `${label}.subtask_done`, { min: 0 })
  }
}

function parseTaskDuePrecision(value: unknown, label: string): TaskDuePrecision | null {
  if (value === null || value === undefined) {
    return null
  }

  const precision = expectString(value, label, { trim: true, minLength: 1, maxLength: 16 })

  if (precision === 'date' || precision === 'datetime') {
    return precision
  }

  throw new Error(`${label} must be "date" or "datetime"`)
}

function parseTaskPriority(value: unknown, label: string): TaskPriority {
  if (value === null || value === undefined) {
    return DEFAULT_TASK_PRIORITY
  }

  const priority = expectString(value, label, { trim: true, minLength: 1, maxLength: 16 })

  if (TASK_PRIORITY_VALUES.includes(priority as TaskPriority)) {
    return priority as TaskPriority
  }

  throw new Error(`${label} must be one of ${TASK_PRIORITY_VALUES.join(', ')}`)
}

export function parseTasks(value: unknown, label = 'tasks'): Task[] {
  return expectArray(value, label, parseTask)
}

export function parseQuickAddSubmitResult(
  value: unknown,
  label = 'quickAddSubmitResult'
): QuickAddSubmitResult {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['task', 'category', 'categoryCreated'], label)

  return {
    task: parseTask(record.task, `${label}.task`),
    category: parseCategory(record.category, `${label}.category`),
    categoryCreated: expectBoolean(record.categoryCreated, `${label}.categoryCreated`)
  }
}

export function parseQuickAddCommittedEvent(
  value: unknown,
  label = 'quickAddCommittedEvent'
): QuickAddCommittedEvent {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['categoryId', 'categoryCreated'], label)

  return {
    categoryId: expectInteger(record.categoryId, `${label}.categoryId`, { min: 1 }),
    categoryCreated: expectBoolean(record.categoryCreated, `${label}.categoryCreated`)
  }
}

export function parsePendingTaskCounts(
  value: unknown,
  label = 'pendingTaskCounts'
): Record<number, number> {
  const record = expectRecord(value, label)
  const counts: Record<number, number> = {}

  for (const [rawKey, rawValue] of Object.entries(record)) {
    const categoryId = Number.parseInt(rawKey, 10)

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error(`${label} contains invalid category id "${rawKey}"`)
    }

    counts[categoryId] = expectInteger(rawValue, `${label}.${rawKey}`, { min: 0 })
  }

  return counts
}

export function parseAutoCleanupConfig(value: unknown, label = 'autoCleanup'): AutoCleanupConfig {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['enabled', 'days'], label)

  return {
    enabled: expectBoolean(record.enabled, `${label}.enabled`),
    days: expectInteger(record.days, `${label}.days`, { min: 1, max: 365 })
  }
}

export function parsePomodoroTaskBinding(
  value: unknown,
  label: string
): Pick<PomodoroSessionState, 'taskId' | 'taskContentSnapshot'> {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['taskId', 'taskContentSnapshot'], label)

  return parsePomodoroTaskBindingRecord(record, label)
}

function parsePomodoroTaskBindingRecord(
  record: Record<string, unknown>,
  label: string
): Pick<PomodoroSessionState, 'taskId' | 'taskContentSnapshot'> {
  return {
    taskId:
      record.taskId === null ? null : expectInteger(record.taskId, `${label}.taskId`, { min: 1 }),
    taskContentSnapshot:
      record.taskContentSnapshot === null
        ? null
        : expectString(record.taskContentSnapshot, `${label}.taskContentSnapshot`, {
            trim: true,
            minLength: 1,
            maxLength: 200
          })
  }
}

export function parsePomodoroSessionState(
  value: unknown,
  label = 'pomodoroSessionState'
): PomodoroSessionState {
  const record = expectRecord(value, label)
  assertAllowedKeys(
    record,
    ['startedAt', 'endsAt', 'durationSeconds', 'source', 'taskId', 'taskContentSnapshot'],
    label
  )

  return {
    startedAt: expectInteger(record.startedAt, `${label}.startedAt`, { min: 0 }),
    endsAt: expectInteger(record.endsAt, `${label}.endsAt`, { min: 0 }),
    durationSeconds: expectInteger(record.durationSeconds, `${label}.durationSeconds`, {
      min: 1,
      max: 86400
    }),
    source: expectString(record.source, `${label}.source`, { trim: true, minLength: 1 }) as
      | 'global'
      | 'task',
    ...parsePomodoroTaskBindingRecord(record, label)
  }
}

export function parsePomodoroRecord(value: unknown, label = 'pomodoroRecord'): PomodoroRecord {
  const record = expectRecord(value, label)
  assertAllowedKeys(
    record,
    ['id', 'completedAt', 'durationSeconds', 'source', 'taskId', 'taskContentSnapshot'],
    label
  )

  return {
    id: expectString(record.id, `${label}.id`, { trim: true, minLength: 1, maxLength: 128 }),
    completedAt: expectInteger(record.completedAt, `${label}.completedAt`, { min: 0 }),
    durationSeconds: expectInteger(record.durationSeconds, `${label}.durationSeconds`, {
      min: 1,
      max: 86400
    }),
    source: expectString(record.source, `${label}.source`, { trim: true, minLength: 1 }) as
      | 'global'
      | 'task',
    ...parsePomodoroTaskBindingRecord(record, label)
  }
}

export function parsePomodoroData(value: unknown, label = 'pomodoro'): PomodoroData {
  const record = expectRecord(value, label)
  assertAllowedKeys(
    record,
    ['focusDurationSeconds', 'totalCompletedCount', 'activeSession', 'history'],
    label
  )

  return {
    focusDurationSeconds: expectInteger(
      record.focusDurationSeconds,
      `${label}.focusDurationSeconds`,
      {
        min: 1,
        max: 86400
      }
    ),
    totalCompletedCount: expectInteger(record.totalCompletedCount, `${label}.totalCompletedCount`, {
      min: 0
    }),
    activeSession:
      record.activeSession === null
        ? null
        : parsePomodoroSessionState(record.activeSession, `${label}.activeSession`),
    history: expectArray(record.history, `${label}.history`, parsePomodoroRecord)
  }
}

export function parseSettingsData(value: unknown, label = 'settings'): SettingsData {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['autoLaunch', 'closeToTray', 'autoCleanup', 'pomodoro'], label)

  return {
    autoLaunch: expectBoolean(record.autoLaunch, `${label}.autoLaunch`),
    closeToTray: expectBoolean(record.closeToTray, `${label}.closeToTray`),
    autoCleanup: parseAutoCleanupConfig(record.autoCleanup, `${label}.autoCleanup`),
    pomodoro: parsePomodoroData(record.pomodoro, `${label}.pomodoro`)
  }
}

export function parseAppInfo(value: unknown, label = 'appInfo'): AppInfo {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['name', 'version', 'electron', 'chrome', 'node'], label)

  return {
    name: expectString(record.name, `${label}.name`, { trim: true, minLength: 1, maxLength: 128 }),
    version: expectString(record.version, `${label}.version`, {
      trim: true,
      minLength: 1,
      maxLength: 64
    }),
    electron: expectString(record.electron, `${label}.electron`, {
      trim: true,
      minLength: 1,
      maxLength: 64
    }),
    chrome: expectString(record.chrome, `${label}.chrome`, {
      trim: true,
      minLength: 1,
      maxLength: 64
    }),
    node: expectString(record.node, `${label}.node`, { trim: true, minLength: 1, maxLength: 64 })
  }
}

export function parseUpdateStatusData(value: unknown, label = 'updateStatus'): UpdateStatusData {
  const record = expectRecord(value, label)
  const status = expectString(record.status, `${label}.status`, { trim: true, minLength: 1 })

  switch (status) {
    case 'checking':
      assertAllowedKeys(record, ['status'], label)
      return { status }
    case 'available':
      assertAllowedKeys(record, ['status', 'version', 'releaseNotes'], label)
      return {
        status,
        version: expectString(record.version, `${label}.version`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        }),
        releaseNotes:
          record.releaseNotes === undefined
            ? undefined
            : expectString(record.releaseNotes, `${label}.releaseNotes`, { maxLength: 5000 })
      }
    case 'not-available':
      assertAllowedKeys(record, ['status'], label)
      return { status }
    case 'downloading':
      assertAllowedKeys(
        record,
        ['status', 'percent', 'bytesPerSecond', 'transferred', 'total'],
        label
      )
      return {
        status,
        percent: expectInteger(record.percent, `${label}.percent`, { min: 0, max: 100 }),
        bytesPerSecond: expectInteger(record.bytesPerSecond, `${label}.bytesPerSecond`, {
          min: 0
        }),
        transferred: expectInteger(record.transferred, `${label}.transferred`, { min: 0 }),
        total: expectInteger(record.total, `${label}.total`, { min: 0 })
      }
    case 'downloaded':
      assertAllowedKeys(record, ['status', 'version'], label)
      return {
        status,
        version: expectString(record.version, `${label}.version`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        })
      }
    case 'error':
      assertAllowedKeys(record, ['status', 'message'], label)
      return {
        status,
        message: expectString(record.message, `${label}.message`, {
          trim: true,
          minLength: 1,
          maxLength: 500
        })
      }
    default:
      throw new Error(`${label}.status must be a supported updater status`)
  }
}
