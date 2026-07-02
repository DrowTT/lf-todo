import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { TaskDuePrecision, TaskPriority, TaskUpdate } from './types.js'

export interface TodoToolContext {
  bridgePath: string
}

export interface Category {
  id: number
  name: string
  is_system: boolean
  order_index: number
  created_at: number
}

export interface Task {
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
  archived_at?: number | null
  archived_category_name?: string | null
  subtask_total: number
  subtask_done: number
  search_subtask_matches?: string[]
}

export type TaskListFilter = {
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

export type BatchOperation =
  | { type: 'create_category'; name: string }
  | { type: 'rename_category'; id: number; name: string }
  | {
      type: 'create_task'
      content: string
      categoryId?: number
      categoryName?: string
      priority?: TaskPriority
      due_at?: number | null
      due_precision?: 'date' | 'datetime' | null
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

export interface BatchOperationRequest {
  dryRun?: boolean
  createBackup?: boolean
  operations: BatchOperation[]
}

export interface OperationPreview {
  index: number
  type: BatchOperation['type']
  summary: string
  before?: unknown
  after?: unknown
}

export interface OperationResult extends OperationPreview {
  status: 'planned' | 'applied'
  result?: unknown
}

interface BridgeInfo {
  baseUrl: string
  token: string
  pid: number
  appVersion: string
  startedAt: string
}

interface BridgeResponse<T> {
  ok: boolean
  result?: T
  error?: {
    message?: string
  }
}

function expandHome(inputPath: string): string {
  if (inputPath === '~') {
    return homedir()
  }

  if (inputPath.startsWith('~/')) {
    return path.join(homedir(), inputPath.slice(2))
  }

  return inputPath
}

export function getDefaultBridgePath(): string {
  const envPath = process.env.LF_TODO_MCP_BRIDGE_PATH?.trim()
  if (envPath) {
    return path.resolve(expandHome(envPath))
  }

  switch (process.platform) {
    case 'darwin':
      return path.join(homedir(), 'Library', 'Application Support', 'lf-todo', 'mcp-bridge.json')
    case 'win32': {
      const appData = process.env.APPDATA ?? path.join(homedir(), 'AppData', 'Roaming')
      return path.join(appData, 'lf-todo', 'mcp-bridge.json')
    }
    default: {
      const configHome = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config')
      return path.join(configHome, 'lf-todo', 'mcp-bridge.json')
    }
  }
}

export function createTodoToolContext(): TodoToolContext {
  return {
    bridgePath: getDefaultBridgePath()
  }
}

export function closeTodoToolContext(_context?: TodoToolContext): void {
  void _context
  // MCP 不再持有数据库连接，生命周期由 LF-Todo App 管理。
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function readBridgeInfo(context: TodoToolContext): Promise<BridgeInfo> {
  let raw: string

  try {
    raw = await readFile(context.bridgePath, 'utf8')
  } catch {
    throw new Error(`请先启动 LF-Todo 应用，MCP 需要读取桥接文件：${context.bridgePath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`LF-Todo MCP 桥接文件不是有效 JSON：${context.bridgePath}`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`LF-Todo MCP 桥接文件结构无效：${context.bridgePath}`)
  }

  const { baseUrl, token, pid, appVersion, startedAt } = parsed
  if (
    typeof baseUrl !== 'string' ||
    typeof token !== 'string' ||
    typeof pid !== 'number' ||
    typeof appVersion !== 'string' ||
    typeof startedAt !== 'string'
  ) {
    throw new Error(`LF-Todo MCP 桥接文件字段缺失：${context.bridgePath}`)
  }

  return {
    baseUrl,
    token,
    pid,
    appVersion,
    startedAt
  }
}

async function rpc<T>(
  context: TodoToolContext,
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const bridge = await readBridgeInfo(context)
  let response: Response

  try {
    response = await fetch(`${bridge.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bridge.token}`
      },
      body: JSON.stringify({ method, params })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法连接 LF-Todo 应用桥接服务，请确认应用仍在运行：${message}`)
  }

  let payload: BridgeResponse<T>
  try {
    payload = (await response.json()) as BridgeResponse<T>
  } catch {
    throw new Error(`LF-Todo 应用桥接服务返回了无效响应：HTTP ${response.status}`)
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? `LF-Todo 应用桥接调用失败：HTTP ${response.status}`)
  }

  return payload.result as T
}

export async function listCategories(context: TodoToolContext): Promise<Category[]> {
  return rpc<Category[]>(context, 'listCategories')
}

export async function listTasks(
  context: TodoToolContext,
  filter: TaskListFilter = {}
): Promise<Array<Record<string, unknown>>> {
  return rpc<Array<Record<string, unknown>>>(context, 'listTasks', filter as Record<string, unknown>)
}

export async function searchTasks(
  context: TodoToolContext,
  input: {
    query: string
    categoryId?: number | null
    categoryName?: string | null
    limit?: number
  }
): Promise<Array<Record<string, unknown>>> {
  return rpc<Array<Record<string, unknown>>>(context, 'searchTasks', input as Record<string, unknown>)
}

export async function createBackup(context: TodoToolContext): Promise<{
  backupPath: string
  jsonBackupPath: string
}> {
  return rpc<{ backupPath: string; jsonBackupPath: string }>(context, 'createBackup')
}

export async function applyTaskOperations(
  context: TodoToolContext,
  request: BatchOperationRequest
): Promise<{
  dryRun: boolean
  backup?: Awaited<ReturnType<typeof createBackup>>
  operations: OperationResult[]
}> {
  return rpc(context, 'applyTaskOperations', request as unknown as Record<string, unknown>)
}

export async function describeContext(context: TodoToolContext): Promise<Record<string, unknown>> {
  try {
    return await rpc<Record<string, unknown>>(context, 'getContext')
  } catch (error) {
    return {
      transport: 'app-bridge',
      requiresApp: true,
      connected: false,
      bridgePath: context.bridgePath,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
