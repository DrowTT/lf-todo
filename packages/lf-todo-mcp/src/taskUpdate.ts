import type { TaskDuePrecision, TaskPriority, TaskUpdate } from './types.js'

function expectString(
  value: unknown,
  label: string,
  options: { trim?: boolean; minLength?: number; maxLength?: number } = {}
): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }

  const nextValue = options.trim ? value.trim() : value
  if (options.minLength !== undefined && nextValue.length < options.minLength) {
    throw new Error(`${label} is too short`)
  }

  if (options.maxLength !== undefined && nextValue.length > options.maxLength) {
    throw new Error(`${label} is too long`)
  }

  return nextValue
}

function expectInteger(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {}
): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`)
  }

  const nextValue = value as number
  if (options.min !== undefined && nextValue < options.min) {
    throw new Error(`${label} is too small`)
  }

  if (options.max !== undefined && nextValue > options.max) {
    throw new Error(`${label} is too large`)
  }

  return nextValue
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`)
  }

  return value
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }

  return value as Record<string, unknown>
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: string[],
  label: string
): void {
  const allowed = new Set(allowedKeys)
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new Error(`${label}.${key} is not allowed`)
    }
  }
}

function parseTaskPriority(value: unknown, label: string): TaskPriority {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value
  }

  throw new Error(`${label} must be low, medium or high`)
}

function parseTaskDuePrecision(value: unknown, label: string): TaskDuePrecision {
  if (value === 'date' || value === 'datetime') {
    return value
  }

  throw new Error(`${label} must be date or datetime`)
}

function parseDueState(
  record: Record<string, unknown>,
  label: string
): Pick<TaskUpdate, 'due_at' | 'due_precision'> | null {
  const hasDueAt = 'due_at' in record
  const hasDuePrecision = 'due_precision' in record

  if (hasDueAt !== hasDuePrecision) {
    throw new Error(`${label} must include due_at and due_precision together`)
  }

  if (!hasDueAt) {
    return null
  }

  if (record.due_at === null && record.due_precision === null) {
    return {
      due_at: null,
      due_precision: null
    }
  }

  return {
    due_at: expectInteger(record.due_at, `${label}.due_at`, { min: 0 }),
    due_precision: parseTaskDuePrecision(record.due_precision, `${label}.due_precision`)
  }
}

export function parseTaskUpdate(value: unknown, label = 'updates'): TaskUpdate {
  const record = expectRecord(value, label)
  assertAllowedKeys(
    record,
    [
      'content',
      'description',
      'is_completed',
      'order_index',
      'due_at',
      'due_precision',
      'priority'
    ],
    label
  )

  const updates: TaskUpdate = {}

  if ('content' in record) {
    updates.content = expectString(record.content, `${label}.content`, {
      trim: true,
      minLength: 1,
      maxLength: 200
    })
  }

  if ('description' in record) {
    updates.description =
      record.description === null
        ? null
        : expectString(record.description, `${label}.description`, {
            trim: true,
            minLength: 1,
            maxLength: 500
          })
  }

  if ('is_completed' in record) {
    updates.is_completed = expectBoolean(record.is_completed, `${label}.is_completed`)
  }

  if ('order_index' in record) {
    updates.order_index = expectInteger(record.order_index, `${label}.order_index`, { min: 0 })
  }

  if ('priority' in record) {
    updates.priority = parseTaskPriority(record.priority, `${label}.priority`)
  }

  const dueState = parseDueState(record, label)
  if (dueState) {
    updates.due_at = dueState.due_at
    updates.due_precision = dueState.due_precision
  }

  if (Object.keys(updates).length === 0) {
    throw new Error(`${label} must include at least one updatable field`)
  }

  return updates
}
