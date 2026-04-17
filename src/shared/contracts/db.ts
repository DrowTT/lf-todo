import type {
  QuickAddSubmitInput,
  TaskCreateInput,
  TaskDueState,
  TaskUpdate
} from '../types/models'
import {
  assertAllowedKeys,
  expectArray,
  expectBoolean,
  expectInteger,
  expectRecord,
  expectString
} from './utils'
import { parseTaskDuePrecision, parseTaskPriority } from './taskFields'

export type CreateTaskRequest = TaskCreateInput
export type QuickAddSubmitRequest = QuickAddSubmitInput

export interface CreateSubTaskRequest {
  content: string
  parentId: number
}

export interface UpdateTaskRequest {
  id: number
  updates: TaskUpdate
}

export interface SetTaskCompletedRequest {
  id: number
  completed: boolean
}

export interface ReorderTasksRequest {
  orderedIds: number[]
}

export interface SearchTasksRequest {
  query: string
  categoryId: number | null
  limit: number
}

export interface RestoreArchivedTasksRequest {
  ids: number[]
}

export interface ArchiveTaskRequest {
  id: number
}

function parseOrderedIds(value: unknown, label: string): number[] {
  const orderedIds = expectArray(value, label, (item, itemLabel) =>
    expectInteger(item, itemLabel, { min: 1 })
  )

  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new Error(`${label} must not contain duplicate task ids`)
  }

  return orderedIds
}

export function parseCreateTaskRequest(value: unknown, label = 'payload'): CreateTaskRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['content', 'categoryId', 'due_at', 'due_precision', 'priority'], label)
  const dueState = parseTaskDueStateRecord(record, label, {
    dueAtKey: 'due_at',
    duePrecisionKey: 'due_precision'
  }) ?? { due_at: null, due_precision: null }

  return {
    content: expectString(record.content, `${label}.content`, {
      trim: true,
      minLength: 1,
      maxLength: 100
    }),
    categoryId: expectInteger(record.categoryId, `${label}.categoryId`, { min: 1 }),
    priority: parseTaskPriority(record.priority, `${label}.priority`),
    ...dueState
  }
}

export function parseCreateSubTaskRequest(value: unknown, label = 'payload'): CreateSubTaskRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['content', 'parentId'], label)

  return {
    content: expectString(record.content, `${label}.content`, {
      trim: true,
      minLength: 1,
      maxLength: 200
    }),
    parentId: expectInteger(record.parentId, `${label}.parentId`, { min: 1 })
  }
}

export function parseQuickAddSubmitRequest(
  value: unknown,
  label = 'payload'
): QuickAddSubmitRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['content', 'categoryId', 'categoryName'], label)

  const categoryId =
    record.categoryId === null
      ? null
      : expectInteger(record.categoryId, `${label}.categoryId`, { min: 1 })
  const categoryName =
    record.categoryName === null
      ? null
      : expectString(record.categoryName, `${label}.categoryName`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        })

  if (categoryId === null && categoryName === null) {
    throw new Error(`${label} must include categoryId or categoryName`)
  }

  return {
    content: expectString(record.content, `${label}.content`, {
      trim: true,
      minLength: 1,
      maxLength: 100
    }),
    categoryId,
    categoryName
  }
}

export function parseTaskUpdate(value: unknown, label = 'updates'): TaskUpdate {
  const record = expectRecord(value, label)
  assertAllowedKeys(
    record,
    ['content', 'is_completed', 'order_index', 'due_at', 'due_precision', 'priority'],
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

  if ('is_completed' in record) {
    updates.is_completed = expectBoolean(record.is_completed, `${label}.is_completed`)
  }

  if ('order_index' in record) {
    updates.order_index = expectInteger(record.order_index, `${label}.order_index`, { min: 0 })
  }

  if ('priority' in record) {
    updates.priority = parseTaskPriority(record.priority, `${label}.priority`)
  }

  const dueState = parseTaskDueStateRecord(record, label, {
    dueAtKey: 'due_at',
    duePrecisionKey: 'due_precision',
    optional: true
  })

  if (dueState) {
    updates.due_at = dueState.due_at
    updates.due_precision = dueState.due_precision
  }

  if (Object.keys(updates).length === 0) {
    throw new Error(`${label} must include at least one updatable field`)
  }

  return updates
}

export function parseUpdateTaskRequest(value: unknown, label = 'payload'): UpdateTaskRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['id', 'updates'], label)

  return {
    id: expectInteger(record.id, `${label}.id`, { min: 1 }),
    updates: parseTaskUpdate(record.updates, `${label}.updates`)
  }
}

export function parseSetTaskCompletedRequest(
  value: unknown,
  label = 'payload'
): SetTaskCompletedRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['id', 'completed'], label)

  return {
    id: expectInteger(record.id, `${label}.id`, { min: 1 }),
    completed: expectBoolean(record.completed, `${label}.completed`)
  }
}

export function parseReorderTasksRequest(value: unknown, label = 'payload'): ReorderTasksRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['orderedIds'], label)

  return {
    orderedIds: parseOrderedIds(record.orderedIds, `${label}.orderedIds`)
  }
}

export function parseSearchTasksRequest(value: unknown, label = 'payload'): SearchTasksRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['query', 'categoryId', 'limit'], label)

  return {
    query: expectString(record.query, `${label}.query`, {
      trim: true,
      minLength: 1,
      maxLength: 100
    }),
    categoryId:
      record.categoryId === null || record.categoryId === undefined
        ? null
        : expectInteger(record.categoryId, `${label}.categoryId`, { min: 1 }),
    limit:
      record.limit === undefined
        ? 24
        : expectInteger(record.limit, `${label}.limit`, { min: 1, max: 50 })
  }
}

export function parseRestoreArchivedTasksRequest(
  value: unknown,
  label = 'payload'
): RestoreArchivedTasksRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['ids'], label)

  return {
    ids: parseOrderedIds(record.ids, `${label}.ids`)
  }
}

export function parseArchiveTaskRequest(value: unknown, label = 'payload'): ArchiveTaskRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['id'], label)

  return {
    id: expectInteger(record.id, `${label}.id`, { min: 1 })
  }
}

function parseTaskDueStateRecord(
  record: Record<string, unknown>,
  label: string,
  options: {
    dueAtKey: string
    duePrecisionKey: string
    optional?: boolean
  }
): TaskDueState | null {
  const hasDueAt = options.dueAtKey in record
  const hasDuePrecision = options.duePrecisionKey in record

  if (hasDueAt !== hasDuePrecision) {
    throw new Error(
      `${label} must include ${options.dueAtKey} and ${options.duePrecisionKey} together`
    )
  }

  if (!hasDueAt) {
    if (options.optional) {
      return null
    }

    return {
      due_at: null,
      due_precision: null
    }
  }

  const rawDueAt = record[options.dueAtKey]
  const rawDuePrecision = record[options.duePrecisionKey]

  if (rawDueAt === null || rawDuePrecision === null) {
    if (rawDueAt !== null || rawDuePrecision !== null) {
      throw new Error(
        `${label} must clear ${options.dueAtKey} and ${options.duePrecisionKey} together`
      )
    }

    return {
      due_at: null,
      due_precision: null
    }
  }

  return {
    due_at: expectInteger(rawDueAt, `${label}.${options.dueAtKey}`, { min: 0 }),
    due_precision: parseTaskDuePrecision(rawDuePrecision, `${label}.${options.duePrecisionKey}`)
  }
}
