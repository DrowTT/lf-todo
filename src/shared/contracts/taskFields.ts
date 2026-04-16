import { DEFAULT_TASK_PRIORITY, TASK_PRIORITY_VALUES } from '../constants/task'
import type { TaskDuePrecision, TaskPriority } from '../types/models'
import { expectString } from './utils'

export function parseTaskDuePrecision(value: unknown, label: string): TaskDuePrecision {
  const precision = expectString(value, label, { trim: true, minLength: 1, maxLength: 16 })

  if (precision === 'date' || precision === 'datetime') {
    return precision
  }

  throw new Error(`${label} must be "date" or "datetime"`)
}

export function parseNullableTaskDuePrecision(
  value: unknown,
  label: string
): TaskDuePrecision | null {
  if (value === null || value === undefined) {
    return null
  }

  return parseTaskDuePrecision(value, label)
}

export function parseTaskPriority(value: unknown, label: string): TaskPriority {
  if (value === null || value === undefined) {
    return DEFAULT_TASK_PRIORITY
  }

  const priority = expectString(value, label, { trim: true, minLength: 1, maxLength: 16 })

  if (TASK_PRIORITY_VALUES.includes(priority as TaskPriority)) {
    return priority as TaskPriority
  }

  throw new Error(`${label} must be one of ${TASK_PRIORITY_VALUES.join(', ')}`)
}
