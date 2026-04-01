import type { TaskUpdate } from '../types/models'
import {
  assertAllowedKeys,
  expectArray,
  expectBoolean,
  expectInteger,
  expectRecord,
  expectString
} from './utils'

export interface CreateTaskRequest {
  content: string
  categoryId: number
}

export interface CreateSubTaskRequest {
  content: string
  parentId: number
}

export interface UpdateTaskRequest {
  id: number
  updates: TaskUpdate
}

export interface DeleteTasksRequest {
  ids: number[]
}

export interface SetTaskCompletedRequest {
  id: number
  completed: boolean
}

export interface ReorderTasksRequest {
  orderedIds: number[]
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
  assertAllowedKeys(record, ['content', 'categoryId'], label)

  return {
    content: expectString(record.content, `${label}.content`, {
      trim: true,
      minLength: 1,
      maxLength: 100
    }),
    categoryId: expectInteger(record.categoryId, `${label}.categoryId`, { min: 1 })
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

export function parseTaskUpdate(value: unknown, label = 'updates'): TaskUpdate {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['content', 'is_completed', 'order_index'], label)

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

export function parseDeleteTasksRequest(value: unknown, label = 'payload'): DeleteTasksRequest {
  const record = expectRecord(value, label)
  assertAllowedKeys(record, ['ids'], label)

  return {
    ids: parseOrderedIds(record.ids, `${label}.ids`)
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
