import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import * as db from './db/database'
import { buildBackupEnvelope } from '../shared/contracts/backup'
import { parseTaskUpdate } from '../shared/contracts/db'
import {
  expectArray,
  expectBoolean,
  expectInteger,
  expectRecord,
  expectString
} from '../shared/contracts/utils'
import { DEFAULT_TASK_PRIORITY } from '../shared/constants/task'
import type {
  CodexControlStatus,
  CodexControlStatusEvent,
  TaskDuePrecision,
  TaskPriority,
  TaskUpdate
} from '../shared/types/models'

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type BridgeMethod =
  | 'getContext'
  | 'listCategories'
  | 'listTasks'
  | 'searchTasks'
  | 'createBackup'
  | 'applyTaskOperations'

interface BridgeInfo {
  baseUrl: string
  token: string
  pid: number
  appVersion: string
  startedAt: string
}

interface BridgeOptions {
  userDataPath: string
  appVersion: string
  onDataChanged: () => void
  onControlStatusChanged: (event: CodexControlStatusEvent) => void
}

interface TaskListFilter {
  categoryId?: number | null
  categoryName?: string | null
  includeCompleted?: boolean
  onlyCompleted?: boolean
  priority?: TaskPriority | null
  dueBefore?: number | null
  dueAfter?: number | null
  limit?: number
  includeSubtasks?: boolean
}

type BatchOperation =
  | { type: 'create_category'; name: string }
  | { type: 'rename_category'; id: number; name: string }
  | {
      type: 'create_task'
      content: string
      categoryId?: number
      categoryName?: string
      priority?: TaskPriority
      due_at?: number | null
      due_precision?: TaskDuePrecision | null
    }
  | { type: 'update_task'; id: number; updates: TaskUpdate }
  | { type: 'complete_task'; id: number; completed?: boolean }
  | {
      type: 'move_task'
      id: number
      targetCategoryId?: number
      targetCategoryName?: string
      createCategoryIfMissing?: boolean
    }
  | { type: 'archive_task'; id: number }
  | { type: 'archive_completed'; categoryId?: number; categoryName?: string }

interface BatchOperationRequest {
  dryRun?: boolean
  createBackup?: boolean
  operations: BatchOperation[]
}

interface OperationPreview {
  index: number
  type: BatchOperation['type']
  summary: string
  before?: unknown
  after?: unknown
}

interface OperationResult extends OperationPreview {
  status: 'planned' | 'applied'
  result?: unknown
}

let server: Server | null = null
let currentInfo: BridgeInfo | null = null
let bridgeFilePath: string | null = null
let options: BridgeOptions | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseTaskPriority(value: unknown, label: string): TaskPriority {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value
  }

  throw new Error(`${label} must be low, medium or high`)
}

function parseOptionalTaskPriority(value: unknown, label: string): TaskPriority | undefined {
  return value === undefined ? undefined : parseTaskPriority(value, label)
}

function parseNullableTaskPriority(value: unknown, label: string): TaskPriority | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  return parseTaskPriority(value, label)
}

function parseBridgeMethod(value: unknown, label: string): BridgeMethod {
  const method = expectString(value, label)

  if (
    method === 'getContext' ||
    method === 'listCategories' ||
    method === 'listTasks' ||
    method === 'searchTasks' ||
    method === 'createBackup' ||
    method === 'applyTaskOperations'
  ) {
    return method
  }

  throw new Error(`${label} is not supported`)
}

function parseTaskDuePrecision(value: unknown, label: string): TaskDuePrecision {
  if (value === 'date' || value === 'datetime') {
    return value
  }

  throw new Error(`${label} must be date or datetime`)
}

function parseOptionalDuePrecision(
  value: unknown,
  label: string
): TaskDuePrecision | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  return parseTaskDuePrecision(value, label)
}

function parseOptionalInteger(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {}
): number | undefined {
  return value === undefined ? undefined : expectInteger(value, label, options)
}

function parseNullableInteger(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {}
): number | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  return expectInteger(value, label, options)
}

function parseOptionalBoolean(value: unknown, label: string): boolean | undefined {
  return value === undefined ? undefined : expectBoolean(value, label)
}

function parseOptionalString(
  value: unknown,
  label: string,
  stringOptions: { trim?: boolean; minLength?: number; maxLength?: number }
): string | undefined {
  return value === undefined ? undefined : expectString(value, label, stringOptions)
}

function parseNullableString(
  value: unknown,
  label: string,
  stringOptions: { trim?: boolean; minLength?: number; maxLength?: number }
): string | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  return expectString(value, label, stringOptions)
}

function parseListTasksFilter(value: unknown): TaskListFilter {
  const record = value === undefined ? {} : expectRecord(value, 'params')

  return {
    categoryId: parseNullableInteger(record.categoryId, 'params.categoryId', { min: 1 }),
    categoryName: parseNullableString(record.categoryName, 'params.categoryName', {
      trim: true,
      minLength: 1,
      maxLength: 64
    }),
    includeCompleted: parseOptionalBoolean(record.includeCompleted, 'params.includeCompleted'),
    onlyCompleted: parseOptionalBoolean(record.onlyCompleted, 'params.onlyCompleted'),
    priority: parseNullableTaskPriority(record.priority, 'params.priority'),
    dueBefore: parseNullableInteger(record.dueBefore, 'params.dueBefore', { min: 0 }),
    dueAfter: parseNullableInteger(record.dueAfter, 'params.dueAfter', { min: 0 }),
    limit: parseOptionalInteger(record.limit, 'params.limit', { min: 1, max: 500 }),
    includeSubtasks: parseOptionalBoolean(record.includeSubtasks, 'params.includeSubtasks')
  }
}

function parseSearchTasksInput(value: unknown): {
  query: string
  categoryId?: number | null
  categoryName?: string | null
  limit?: number
} {
  const record = expectRecord(value, 'params')

  return {
    query: expectString(record.query, 'params.query', {
      trim: true,
      minLength: 1,
      maxLength: 100
    }),
    categoryId: parseNullableInteger(record.categoryId, 'params.categoryId', { min: 1 }),
    categoryName: parseNullableString(record.categoryName, 'params.categoryName', {
      trim: true,
      minLength: 1,
      maxLength: 64
    }),
    limit: parseOptionalInteger(record.limit, 'params.limit', { min: 1, max: 50 })
  }
}

function parseBatchOperation(value: unknown, label: string): BatchOperation {
  const record = expectRecord(value, label)
  const type = expectString(record.type, `${label}.type`)

  switch (type) {
    case 'create_category':
      return {
        type,
        name: expectString(record.name, `${label}.name`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        })
      }
    case 'rename_category':
      return {
        type,
        id: expectInteger(record.id, `${label}.id`, { min: 1 }),
        name: expectString(record.name, `${label}.name`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        })
      }
    case 'create_task':
      return {
        type,
        content: expectString(record.content, `${label}.content`, {
          trim: true,
          minLength: 1,
          maxLength: 100
        }),
        categoryId: parseOptionalInteger(record.categoryId, `${label}.categoryId`, { min: 1 }),
        categoryName: parseOptionalString(record.categoryName, `${label}.categoryName`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        }),
        priority: parseOptionalTaskPriority(record.priority, `${label}.priority`),
        due_at: parseNullableInteger(record.due_at, `${label}.due_at`, { min: 0 }),
        due_precision: parseOptionalDuePrecision(record.due_precision, `${label}.due_precision`)
      }
    case 'update_task':
      return {
        type,
        id: expectInteger(record.id, `${label}.id`, { min: 1 }),
        updates: parseTaskUpdate(record.updates, `${label}.updates`)
      }
    case 'complete_task':
      return {
        type,
        id: expectInteger(record.id, `${label}.id`, { min: 1 }),
        completed: parseOptionalBoolean(record.completed, `${label}.completed`)
      }
    case 'move_task':
      return {
        type,
        id: expectInteger(record.id, `${label}.id`, { min: 1 }),
        targetCategoryId: parseOptionalInteger(record.targetCategoryId, `${label}.targetCategoryId`, {
          min: 1
        }),
        targetCategoryName: parseOptionalString(record.targetCategoryName, `${label}.targetCategoryName`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        }),
        createCategoryIfMissing: parseOptionalBoolean(
          record.createCategoryIfMissing,
          `${label}.createCategoryIfMissing`
        )
      }
    case 'archive_task':
      return {
        type,
        id: expectInteger(record.id, `${label}.id`, { min: 1 })
      }
    case 'archive_completed':
      return {
        type,
        categoryId: parseOptionalInteger(record.categoryId, `${label}.categoryId`, { min: 1 }),
        categoryName: parseOptionalString(record.categoryName, `${label}.categoryName`, {
          trim: true,
          minLength: 1,
          maxLength: 64
        })
      }
    default:
      throw new Error(`${label}.type is not supported`)
  }
}

function parseBatchOperationRequest(value: unknown): BatchOperationRequest {
  const record = expectRecord(value, 'params')
  const operations = expectArray(record.operations, 'params.operations', parseBatchOperation)

  if (operations.length < 1 || operations.length > 100) {
    throw new Error('params.operations length must be between 1 and 100')
  }

  return {
    dryRun: parseOptionalBoolean(record.dryRun, 'params.dryRun'),
    createBackup: parseOptionalBoolean(record.createBackup, 'params.createBackup'),
    operations
  }
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function getCategoryByName(name: string): db.Category | undefined {
  const normalizedName = normalizeName(name)
  return db.getAllCategories().find((category) => normalizeName(category.name) === normalizedName)
}

function requireCategoryByName(name: string): db.Category {
  const category = getCategoryByName(name)
  if (!category) {
    throw new Error(`分类不存在：${name}`)
  }

  return category
}

function resolveCategoryId(input: {
  categoryId?: number | null
  categoryName?: string | null
  createIfMissing?: boolean
}): number {
  if (input.categoryId !== undefined && input.categoryId !== null) {
    if (!db.getCategoryById(input.categoryId)) {
      throw new Error(`分类不存在：${input.categoryId}`)
    }

    return input.categoryId
  }

  const categoryName = input.categoryName?.trim()
  if (!categoryName) {
    throw new Error('需要提供分类 ID 或分类名称')
  }

  const category = getCategoryByName(categoryName)
  if (category) {
    return category.id
  }

  if (input.createIfMissing) {
    return db.createCategory(categoryName).id
  }

  throw new Error(`分类不存在：${categoryName}`)
}

function taskSummary(task: db.Task): Record<string, unknown> {
  return {
    id: task.id,
    content: task.content,
    description: task.description,
    is_completed: task.is_completed,
    category_id: task.category_id,
    parent_id: task.parent_id,
    priority: task.priority,
    due_at: task.due_at,
    due_precision: task.due_precision,
    subtask_total: task.subtask_total,
    subtask_done: task.subtask_done
  }
}

function categoryNameMap(): Map<number, string> {
  return new Map(db.getAllCategories().map((category) => [category.id, category.name]))
}

function listTasks(filter: TaskListFilter = {}): Array<Record<string, unknown>> {
  const targetCategoryId =
    filter.categoryName && filter.categoryName.trim()
      ? requireCategoryByName(filter.categoryName).id
      : (filter.categoryId ?? null)
  const categories = categoryNameMap()
  const tasks =
    targetCategoryId === null || targetCategoryId === undefined
      ? db.getAllTasks()
      : db.getTasksByCategory(targetCategoryId)

  const includeCompleted = filter.includeCompleted ?? false
  const onlyCompleted = filter.onlyCompleted ?? false
  const limit = filter.limit ?? 100

  return tasks
    .filter((task) => {
      if (onlyCompleted && !task.is_completed) {
        return false
      }

      if (!includeCompleted && !onlyCompleted && task.is_completed) {
        return false
      }

      if (filter.priority && task.priority !== filter.priority) {
        return false
      }

      if (filter.dueBefore !== null && filter.dueBefore !== undefined) {
        if (task.due_at === null || task.due_at > filter.dueBefore) {
          return false
        }
      }

      if (filter.dueAfter !== null && filter.dueAfter !== undefined) {
        if (task.due_at === null || task.due_at < filter.dueAfter) {
          return false
        }
      }

      return true
    })
    .slice(0, limit)
    .map((task) => ({
      ...taskSummary(task),
      category_name: categories.get(task.category_id) ?? null,
      subtasks: filter.includeSubtasks ? db.getSubTasks(task.id).map(taskSummary) : undefined
    }))
}

function searchTasks(input: {
  query: string
  categoryId?: number | null
  categoryName?: string | null
  limit?: number
}): Array<Record<string, unknown>> {
  const categoryId =
    input.categoryName && input.categoryName.trim()
      ? requireCategoryByName(input.categoryName).id
      : (input.categoryId ?? null)
  const categories = categoryNameMap()

  return db
    .searchTasks({
      query: input.query,
      categoryId,
      limit: input.limit ?? 24
    })
    .map((task) => ({
      ...taskSummary(task),
      category_name: categories.get(task.category_id) ?? null,
      search_subtask_matches: task.search_subtask_matches ?? []
    }))
}

async function createBackup(userDataPath: string, appVersion: string): Promise<{
  backupPath: string
  jsonBackupPath: string
}> {
  const backupDir = join(userDataPath, 'codex-backups')
  await mkdir(backupDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(backupDir, `lite-todo-${timestamp}.db`)
  const jsonBackupPath = join(backupDir, `lf-todo-backup-${timestamp}.json`)

  await db.backupDatabase(backupPath)
  await writeFile(
    jsonBackupPath,
    JSON.stringify(buildBackupEnvelope(db.exportAllData(), appVersion), null, 2),
    'utf8'
  )

  return {
    backupPath,
    jsonBackupPath
  }
}

function previewOperation(operation: BatchOperation, index: number): OperationPreview {
  switch (operation.type) {
    case 'create_category':
      return {
        index,
        type: operation.type,
        summary: `创建分类「${operation.name.trim()}」`,
        after: { name: operation.name.trim() }
      }
    case 'rename_category': {
      const category = db.getCategoryById(operation.id)
      return {
        index,
        type: operation.type,
        summary: `重命名分类 #${operation.id} 为「${operation.name.trim()}」`,
        before: category ?? null,
        after: { ...(category ?? { id: operation.id }), name: operation.name.trim() }
      }
    }
    case 'create_task': {
      const existingCategory = operation.categoryName
        ? getCategoryByName(operation.categoryName)
        : undefined
      const categoryTarget =
        operation.categoryId ??
        existingCategory?.id ??
        (operation.categoryName ? `新分类：${operation.categoryName.trim()}` : null)
      if (categoryTarget === null) {
        throw new Error('需要提供分类 ID 或分类名称')
      }

      const categoryLabel =
        typeof categoryTarget === 'number' ? `分类 #${categoryTarget}` : categoryTarget
      return {
        index,
        type: operation.type,
        summary: `在${categoryLabel}创建待办「${operation.content.trim()}」`,
        after: {
          content: operation.content.trim(),
          category_id: categoryTarget,
          priority: operation.priority ?? DEFAULT_TASK_PRIORITY,
          due_at: operation.due_at ?? null,
          due_precision: operation.due_precision ?? null
        }
      }
    }
    case 'update_task': {
      const task = db.getTaskById(operation.id)
      return {
        index,
        type: operation.type,
        summary: `更新待办 #${operation.id}`,
        before: task ? taskSummary(task) : null,
        after: operation.updates
      }
    }
    case 'complete_task': {
      const task = db.getTaskById(operation.id)
      const completed = operation.completed ?? true
      return {
        index,
        type: operation.type,
        summary: `${completed ? '完成' : '恢复未完成'}待办 #${operation.id}`,
        before: task ? taskSummary(task) : null,
        after: { is_completed: completed }
      }
    }
    case 'move_task': {
      const task = db.getTaskById(operation.id)
      const targetCategoryId =
        operation.createCategoryIfMissing && operation.targetCategoryName
          ? (getCategoryByName(operation.targetCategoryName)?.id ??
            `新分类：${operation.targetCategoryName.trim()}`)
          : resolveCategoryId({
              categoryId: operation.targetCategoryId,
              categoryName: operation.targetCategoryName,
              createIfMissing: false
            })
      return {
        index,
        type: operation.type,
        summary: `移动待办 #${operation.id} 到分类 #${targetCategoryId}`,
        before: task ? taskSummary(task) : null,
        after: { category_id: targetCategoryId }
      }
    }
    case 'archive_task': {
      const task = db.getTaskById(operation.id)
      return {
        index,
        type: operation.type,
        summary: `归档待办 #${operation.id}`,
        before: task ? taskSummary(task) : null
      }
    }
    case 'archive_completed': {
      const categoryId =
        operation.categoryId !== undefined || operation.categoryName !== undefined
          ? resolveCategoryId({
              categoryId: operation.categoryId,
              categoryName: operation.categoryName,
              createIfMissing: false
            })
          : null
      return {
        index,
        type: operation.type,
        summary: categoryId === null ? '归档全部已完成待办' : `归档分类 #${categoryId} 的已完成待办`,
        before: { category_id: categoryId }
      }
    }
  }
}

function applyOperation(operation: BatchOperation, index: number): OperationResult {
  const preview = previewOperation(operation, index)

  switch (operation.type) {
    case 'create_category':
      return {
        ...preview,
        status: 'applied',
        result: db.createCategory(operation.name.trim())
      }
    case 'rename_category':
      db.updateCategory(operation.id, operation.name.trim())
      return {
        ...preview,
        status: 'applied',
        result: db.getCategoryById(operation.id) ?? null
      }
    case 'create_task': {
      const categoryId = resolveCategoryId({
        categoryId: operation.categoryId,
        categoryName: operation.categoryName,
        createIfMissing: true
      })
      return {
        ...preview,
        status: 'applied',
        result: taskSummary(
          db.createTask({
            content: operation.content.trim(),
            categoryId,
            priority: operation.priority ?? DEFAULT_TASK_PRIORITY,
            due_at: operation.due_at ?? null,
            due_precision: operation.due_precision ?? null
          })
        )
      }
    }
    case 'update_task':
      db.updateTask(operation.id, operation.updates)
      return {
        ...preview,
        status: 'applied',
        result: db.getTaskById(operation.id) ?? null
      }
    case 'complete_task':
      db.setTaskCompleted(operation.id, operation.completed ?? true)
      return {
        ...preview,
        status: 'applied',
        result: db.getTaskById(operation.id) ?? null
      }
    case 'move_task': {
      const targetCategoryId = resolveCategoryId({
        categoryId: operation.targetCategoryId,
        categoryName: operation.targetCategoryName,
        createIfMissing: operation.createCategoryIfMissing ?? false
      })
      db.moveTaskToCategory(operation.id, targetCategoryId)
      return {
        ...preview,
        status: 'applied',
        result: db.getTaskById(operation.id) ?? null
      }
    }
    case 'archive_task':
      db.archiveTask(operation.id)
      return {
        ...preview,
        status: 'applied',
        result: { archived: true }
      }
    case 'archive_completed': {
      const categoryId =
        operation.categoryId !== undefined || operation.categoryName !== undefined
          ? resolveCategoryId({
              categoryId: operation.categoryId,
              categoryName: operation.categoryName,
              createIfMissing: false
            })
          : undefined
      const archivedCount =
        categoryId === undefined ? db.archiveAllCompletedTasks() : db.archiveCompletedTasks(categoryId)
      return {
        ...preview,
        status: 'applied',
        result: { archivedCount }
      }
    }
  }
}

async function applyTaskOperations(
  request: BatchOperationRequest,
  bridgeOptions: BridgeOptions
): Promise<{
  dryRun: boolean
  backup?: Awaited<ReturnType<typeof createBackup>>
  operations: OperationResult[]
}> {
  const dryRun = request.dryRun ?? true
  const operations = request.operations.map((operation, index) => previewOperation(operation, index))

  if (dryRun) {
    return {
      dryRun,
      operations: operations.map((operation) => ({ ...operation, status: 'planned' }))
    }
  }

  const backup =
    request.createBackup === false
      ? undefined
      : await createBackup(bridgeOptions.userDataPath, bridgeOptions.appVersion)
  const applied = db.runTransaction(() =>
    request.operations.map((operation, index) => applyOperation(operation, index))
  )

  bridgeOptions.onDataChanged()

  return {
    dryRun,
    backup,
    operations: applied
  }
}

function getContext(bridgeOptions: BridgeOptions): Record<string, unknown> {
  return {
    transport: 'app-bridge',
    requiresApp: true,
    connected: true,
    appVersion: bridgeOptions.appVersion,
    userDataPath: bridgeOptions.userDataPath,
    backupDir: join(bridgeOptions.userDataPath, 'codex-backups'),
    bridgePath: bridgeFilePath,
    pid: process.pid,
    categoryCount: db.getAllCategories().length,
    activeRootTaskCount: db.getAllTasks().length,
    archivedRootTaskCount: db.getArchivedTaskGroups().length
  }
}

async function handleBridgeMethod(
  method: BridgeMethod,
  params: unknown,
  bridgeOptions: BridgeOptions
): Promise<unknown> {
  switch (method) {
    case 'getContext':
      return getContext(bridgeOptions)
    case 'listCategories':
      return db.getAllCategories()
    case 'listTasks':
      return listTasks(parseListTasksFilter(params))
    case 'searchTasks':
      return searchTasks(parseSearchTasksInput(params))
    case 'createBackup':
      return createBackup(bridgeOptions.userDataPath, bridgeOptions.appVersion)
    case 'applyTaskOperations':
      return applyTaskOperations(parseBatchOperationRequest(params), bridgeOptions)
  }
}

function getOperationCount(method: BridgeMethod, params: unknown): number {
  if (method !== 'applyTaskOperations') {
    return 0
  }

  try {
    const record = expectRecord(params, 'params')
    return Array.isArray(record.operations) ? Math.min(record.operations.length, 100) : 0
  } catch {
    return 0
  }
}

function emitControlStatus(
  bridgeOptions: BridgeOptions,
  status: CodexControlStatus,
  method: BridgeMethod,
  params: unknown,
  changed: boolean
): void {
  bridgeOptions.onControlStatusChanged({
    status,
    method,
    operationCount: getOperationCount(method, params),
    changed
  })
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  response.end(JSON.stringify(payload))
}

function sendError(response: ServerResponse, statusCode: number, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  sendJson(response, statusCode, {
    ok: false,
    error: {
      message
    }
  })
}

function readRequestBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 1024 * 1024) {
        reject(new Error('请求体过大'))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })

    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw) as JsonValue)
      } catch {
        reject(new Error('请求体不是有效 JSON'))
      }
    })
    request.on('error', reject)
  })
}

function isAuthorized(request: IncomingMessage): boolean {
  if (!currentInfo) {
    return false
  }

  return request.headers.authorization === `Bearer ${currentInfo.token}`
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'POST' || request.url !== '/rpc') {
    sendError(response, 404, new Error('Not found'))
    return
  }

  if (!options || !isAuthorized(request)) {
    sendError(response, 401, new Error('Unauthorized'))
    return
  }

  try {
    const body = expectRecord(await readRequestBody(request), 'request')
    const method = parseBridgeMethod(body.method, 'request.method')
    emitControlStatus(options, 'running', method, body.params, false)
    const result = await handleBridgeMethod(method, body.params, options)
    const changed =
      method === 'applyTaskOperations' &&
      isRecord(result) &&
      result.dryRun === false &&
      Array.isArray(result.operations)

    emitControlStatus(options, changed ? 'changed' : 'idle', method, body.params, changed)

    sendJson(response, 200, {
      ok: true,
      result
    })
  } catch (error) {
    options?.onControlStatusChanged({
      status: 'idle',
      method: null,
      operationCount: 0,
      changed: false
    })
    sendError(response, 400, error)
  }
}

export async function startMcpBridge(bridgeOptions: BridgeOptions): Promise<void> {
  if (server) {
    return
  }

  options = bridgeOptions
  bridgeFilePath = join(bridgeOptions.userDataPath, 'mcp-bridge.json')

  await mkdir(bridgeOptions.userDataPath, { recursive: true })

  server = createServer((request, response) => {
    void handleRequest(request, response)
  })

  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject)
    server?.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('MCP bridge address is invalid')
  }

  currentInfo = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    token: randomBytes(32).toString('hex'),
    pid: process.pid,
    appVersion: bridgeOptions.appVersion,
    startedAt: new Date().toISOString()
  }

  await writeFile(bridgeFilePath, JSON.stringify(currentInfo, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}

export function stopMcpBridge(): void {
  server?.close()
  server = null
  currentInfo = null
  options = null

  if (bridgeFilePath) {
    rmSync(bridgeFilePath, { force: true })
    bridgeFilePath = null
  }
}
