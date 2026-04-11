import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { DEFAULT_TASK_PRIORITY } from '../../shared/constants/task'
import type {
  TaskCreateInput,
  TaskDuePrecision,
  TaskDueState,
  TaskPriority,
  TaskUpdate
} from '../../shared/types/models'

let db: Database.Database | null = null

/**
 * 获取已初始化的数据库实例，未初始化时抛出错误
 * 消除各函数中重复的 if (!db) throw 判断（优化 #12）
 */
function getDb(): Database.Database {
  if (!db) throw new Error('数据库未初始化')
  return db
}

// ==================== 迁移机制 ====================

interface Migration {
  version: number
  description: string
  /** 向上迁移的 SQL 语句（可含多条，用分号分隔） */
  up: string
}

/**
 * 按版本号有序排列的迁移脚本。
 * 新增字段/表时，追加一条新 Migration 记录即可；
 * 当前版本由 PRAGMA user_version 持久化存储，重启后自动跳过已执行的迁移。
 *
 * 行业标准：version-based migration（参考 Flyway / Liquibase 思路的轻量实现）
 */
const migrations: Migration[] = [
  {
    version: 1,
    description: '创建 categories 表',
    up: `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `
  },
  {
    version: 2,
    description: '创建 tasks 表（含外键约束）',
    up: `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        category_id INTEGER NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        due_at INTEGER,
        due_precision TEXT,
        priority TEXT NOT NULL DEFAULT '${DEFAULT_TASK_PRIORITY}',
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `
  },
  {
    version: 3,
    description: '为旧版 tasks 表补充 parent_id 字段（新建库中 v2 已包含，此迁移为兼容存量数据库）',
    up: `ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE`
  },
  {
    version: 4,
    description: '为 tasks 表高频查询字段添加索引',
    up: [
      'CREATE INDEX IF NOT EXISTS idx_tasks_category_parent ON tasks(category_id, parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_parent_completed ON tasks(parent_id, is_completed)'
    ].join(';')
  },
  {
    version: 5,
    description: 'add due_at column to tasks',
    up: `ALTER TABLE tasks ADD COLUMN due_at INTEGER`
  },
  {
    version: 6,
    description: 'add due_precision column to tasks',
    up: `ALTER TABLE tasks ADD COLUMN due_precision TEXT`
  },
  {
    version: 7,
    description: 'add priority column to tasks',
    up: `ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT '${DEFAULT_TASK_PRIORITY}'`
  }
]

/**
 * 按序执行未执行过的迁移脚本，并更新 PRAGMA user_version。
 * - 利用 SQLite 内置的 user_version pragma 存储当前 schema 版本，无需额外迁移表。
 * - 每条迁移在独立事务中执行，失败时自动回滚并向上抛出。
 */
function runMigrations(database: Database.Database): void {
  const currentVersion = (database.pragma('user_version') as { user_version: number }[])[0]
    .user_version

  const pending = migrations.filter((m) => m.version > currentVersion)
  if (pending.length === 0) return

  for (const m of pending) {
    // 将每条迁移包裹在事务中，保证原子性
    database.transaction(() => {
      // v3 的 ALTER TABLE 在新建库上会失败（列已存在），用 try/catch 安全跳过
      try {
        database.exec(m.up)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        // 仅忽略「列已存在」错误，其他错误继续向上抛出
        if (!msg.includes('duplicate column name')) throw e
      }
      database.pragma(`user_version = ${m.version}`)
      console.log(`[DB 迁移] v${m.version}: ${m.description}`)
    })()
  }
}

/**
 * 初始化数据库：打开连接 → 启用外键 → 执行迁移 → 准备 statements
 */
export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'lite-todo.db')

  db = new Database(dbPath)

  // 启用外键约束（必须在迁移前设置）
  db.pragma('foreign_keys = ON')
  // 启用 WAL 模式：提升读写并发性能 & 崩溃恢复安全性（better-sqlite3 官方推荐）
  db.pragma('journal_mode = WAL')

  // 按版本号顺序执行所有待执行迁移
  runMigrations(db)

  // 统一预编译所有高频 SQL（避免每次调用重复 prepare）
  stmts = {
    // Category
    getAllCategories: db.prepare('SELECT * FROM categories ORDER BY order_index, id'),
    getCategoryById: db.prepare('SELECT * FROM categories WHERE id = ?'),
    createCategory: db.prepare('INSERT INTO categories (name) VALUES (?)'),
    updateCategory: db.prepare('UPDATE categories SET name = ? WHERE id = ?'),
    deleteCategory: db.prepare('DELETE FROM categories WHERE id = ?'),
    // Task 查询
    getTasksByCategory: db.prepare(`
      SELECT t.*,
        COUNT(s.id) AS subtask_total,
        SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS subtask_done
      FROM tasks t
      LEFT JOIN tasks s ON s.parent_id = t.id
      WHERE t.category_id = ? AND t.parent_id IS NULL
      GROUP BY t.id
      ORDER BY t.order_index DESC, t.id DESC
    `),
    getSubTasks: db.prepare(
      'SELECT * FROM tasks WHERE parent_id = ? ORDER BY order_index ASC, id ASC'
    ),
    getDueReminderTasks: db.prepare(`
      SELECT
        t.id,
        t.content,
        t.category_id,
        c.name AS category_name,
        t.due_at,
        t.due_precision
      FROM tasks t
      INNER JOIN categories c ON c.id = t.category_id
      WHERE
        t.parent_id IS NULL
        AND t.is_completed = 0
        AND t.due_at IS NOT NULL
        AND t.due_precision IS NOT NULL
      ORDER BY t.due_at ASC, t.id ASC
    `),
    getTaskById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
    // Task 写入
    createTask: db.prepare(`
      INSERT INTO tasks (content, category_id, due_at, due_precision, priority)
      VALUES (?, ?, ?, ?, ?)
    `),
    createSubTask: db.prepare(`
      INSERT INTO tasks (content, category_id, parent_id, order_index)
      VALUES (
        ?,
        (SELECT category_id FROM tasks WHERE id = ?),
        ?,
        COALESCE((SELECT MAX(order_index) + 1 FROM tasks WHERE parent_id = ?), 0)
      )
    `),
    updateContent: db.prepare('UPDATE tasks SET content = ? WHERE id = ?'),
    updateCompleted: db.prepare('UPDATE tasks SET is_completed = ? WHERE id = ?'),
    updateOrderIndex: db.prepare('UPDATE tasks SET order_index = ? WHERE id = ?'),
    updateDueAt: db.prepare('UPDATE tasks SET due_at = ? WHERE id = ?'),
    updateDuePrecision: db.prepare('UPDATE tasks SET due_precision = ? WHERE id = ?'),
    updatePriority: db.prepare('UPDATE tasks SET priority = ? WHERE id = ?'),
    deleteTask: db.prepare('DELETE FROM tasks WHERE id = ?'),
    toggleTaskComplete: db.prepare('UPDATE tasks SET is_completed = NOT is_completed WHERE id = ?'),
    batchCompleteSubTasks: db.prepare(
      'UPDATE tasks SET is_completed = 1 WHERE parent_id = ? AND is_completed = 0'
    ),
    // 统计
    getPendingTaskCounts: db.prepare(
      'SELECT category_id, COUNT(*) as count FROM tasks WHERE is_completed = 0 AND parent_id IS NULL GROUP BY category_id'
    )
  }

  console.log('数据库初始化成功:', dbPath)
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ==================== Category CRUD ====================

export interface Category {
  id: number
  name: string
  order_index: number
  created_at: number
}

export function getAllCategories(): Category[] {
  return getStmts().getAllCategories.all() as Category[]
}

export function createCategory(name: string): Category {
  const info = getStmts().createCategory.run(name)
  return getCategoryById(info.lastInsertRowid as number)!
}

export function getCategoryById(id: number): Category | undefined {
  return getStmts().getCategoryById.get(id) as Category | undefined
}

export function updateCategory(id: number, name: string): void {
  getStmts().updateCategory.run(name, id)
}

export function deleteCategory(id: number): void {
  getStmts().deleteCategory.run(id)
}

// ==================== Task CRUD ====================

export interface Task extends TaskDueState {
  id: number
  content: string
  /** SQLite 存 0/1，查询出口统一映射为 boolean（优化 #1） */
  is_completed: boolean
  category_id: number
  order_index: number
  created_at: number
  parent_id: number | null
  priority: TaskPriority
  // 子任务统计（仅顶级任务具备）
  subtask_total: number
  subtask_done: number
}

export interface DueReminderTask {
  id: number
  content: string
  category_id: number
  category_name: string
  due_at: number
  due_precision: TaskDuePrecision
}

/**
 * 将数据库原始行映射为类型安全的 Task 对象
 * better-sqlite3 不自动转换 boolean，在此统一处理（优化 #1）
 */
function mapTask(raw: Record<string, unknown>): Task {
  return {
    id: raw.id as number,
    content: raw.content as string,
    is_completed: raw.is_completed === 1,
    category_id: raw.category_id as number,
    order_index: raw.order_index as number,
    created_at: raw.created_at as number,
    parent_id: (raw.parent_id as number | null | undefined) ?? null,
    due_at: (raw.due_at as number | null | undefined) ?? null,
    due_precision: (raw.due_precision as Task['due_precision'] | null | undefined) ?? null,
    priority: (raw.priority as TaskPriority | null | undefined) ?? DEFAULT_TASK_PRIORITY,
    subtask_total: typeof raw.subtask_total === 'number' ? raw.subtask_total : 0,
    subtask_done: typeof raw.subtask_done === 'number' ? raw.subtask_done : 0
  }
}

export function getTasksByCategory(categoryId: number): Task[] {
  return (getStmts().getTasksByCategory.all(categoryId) as Record<string, unknown>[]).map(mapTask)
}

export function getSubTasks(parentId: number): Task[] {
  return (getStmts().getSubTasks.all(parentId) as Record<string, unknown>[]).map(mapTask)
}

export function getDueReminderTasks(): DueReminderTask[] {
  return (getStmts().getDueReminderTasks.all() as Record<string, unknown>[]).map((raw) => ({
    id: raw.id as number,
    content: raw.content as string,
    category_id: raw.category_id as number,
    category_name: raw.category_name as string,
    due_at: raw.due_at as number,
    due_precision: raw.due_precision as TaskDuePrecision
  }))
}

/**
 * 创建子任务 — 用子查询继承父任务的 category_id，避免额外 SELECT
 */
export function createSubTask(content: string, parentId: number): Task {
  const info = getStmts().createSubTask.run(content, parentId, parentId, parentId)
  return getTaskById(info.lastInsertRowid as number)!
}

export function createTask(input: TaskCreateInput): Task {
  const info = getStmts().createTask.run(
    input.content,
    input.categoryId,
    input.due_at,
    input.due_precision,
    input.priority
  )
  return getTaskById(info.lastInsertRowid as number)!
}

export function getTaskById(id: number): Task | undefined {
  const raw = getStmts().getTaskById.get(id)
  return raw ? mapTask(raw as Record<string, unknown>) : undefined
}

// ─── 预编译 statements 对象（在 initDatabase() 中统一初始化）
let stmts: Record<string, Database.Statement> | null = null

/** 获取已初始化的 statements，未初始化时抛出错误 */
function getStmts() {
  if (!stmts) throw new Error('数据库未初始化')
  return stmts
}

/**
 * 更新任务（按字段拆分为独立 prepared statement）
 */
export function updateTask(id: number, updates: TaskUpdate): void {
  const s = getStmts()
  if (updates.content !== undefined) {
    s.updateContent.run(updates.content, id)
  }
  if (updates.is_completed !== undefined) {
    // 写入时将 boolean 转回 SQLite INTEGER
    s.updateCompleted.run(updates.is_completed ? 1 : 0, id)
  }
  if (updates.order_index !== undefined) {
    s.updateOrderIndex.run(updates.order_index, id)
  }
  if (updates.due_at !== undefined) {
    s.updateDueAt.run(updates.due_at, id)
  }
  if (updates.due_precision !== undefined) {
    s.updateDuePrecision.run(updates.due_precision, id)
  }
  if (updates.priority !== undefined) {
    s.updatePriority.run(updates.priority, id)
  }
}

export function deleteTask(id: number): void {
  getStmts().deleteTask.run(id)
}

/**
 * 批量删除任务（IN 子句，动态参数无法预编译）
 */
export function deleteTasks(ids: number[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  getDb()
    .prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`)
    .run(...ids)
}

export function clearCompletedTasks(categoryId: number): number {
  const result = getDb()
    .prepare('DELETE FROM tasks WHERE category_id = ? AND parent_id IS NULL AND is_completed = 1')
    .run(categoryId)

  return result.changes
}

/** 切换任务完成状态（用于用户手动点击） */
export function toggleTaskComplete(id: number): void {
  getStmts().toggleTaskComplete.run(id)
}

/**
 * 确定性设置任务完成状态（用于联动场景，避免 NOT 翻转的幂等性风险）
 */
export function setTaskCompleted(id: number, completed: boolean): void {
  getStmts().updateCompleted.run(completed ? 1 : 0, id)
}

/** 批量完成指定父任务下的所有未完成子任务 */
export function batchCompleteSubTasks(parentId: number): number {
  const info = getStmts().batchCompleteSubTasks.run(parentId)
  return info.changes
}

/** 获取各分类的待完成任务数量 */
export function getPendingTaskCounts(): Record<number, number> {
  const rows = getStmts().getPendingTaskCounts.all() as { category_id: number; count: number }[]
  return Object.fromEntries(rows.map((r) => [r.category_id, r.count]))
}

/**
 * 批量更新任务排序（事务内执行）
 * orderedIds 数组按展示顺序排列，第一个 = 最大 order_index（匹配 ORDER BY DESC）
 */
export function reorderTasks(orderedIds: number[]): void {
  reorderTaskIds(orderedIds, (index, total) => total - index)
}

/**
 * 批量更新子任务排序（事务内执行）
 * orderedIds 数组按展示顺序排列，第一个 = 最小 order_index（匹配 ORDER BY ASC）
 */
export function reorderSubTasks(orderedIds: number[]): void {
  reorderTaskIds(orderedIds, (index) => index)
}

function reorderTaskIds(
  orderedIds: number[],
  resolveOrderIndex: (index: number, total: number) => number
): void {
  if (orderedIds.length === 0) return

  const s = getStmts()
  const total = orderedIds.length

  getDb().transaction(() => {
    for (let i = 0; i < total; i++) {
      s.updateOrderIndex.run(resolveOrderIndex(i, total), orderedIds[i])
    }
  })()
}

/**
 * 删除指定时间戳之前已完成的任务（用于自动清理功能）
 * 仅删除顶级任务（parent_id IS NULL），子任务通过 CASCADE 自动删除
 */
export function deleteCompletedTasksBefore(timestamp: number): number {
  const result = getDb()
    .prepare('DELETE FROM tasks WHERE is_completed = 1 AND parent_id IS NULL AND created_at < ?')
    .run(timestamp)
  return result.changes
}

/**
 * 导出所有分类和任务数据（用于数据导出功能）
 */
export function exportAllData(): { categories: Category[]; tasks: Task[] } {
  const categories = getStmts().getAllCategories.all() as Category[]
  const allTasks = getDb()
    .prepare('SELECT * FROM tasks ORDER BY category_id, order_index DESC, id DESC')
    .all() as Record<string, unknown>[]
  return {
    categories,
    tasks: allTasks.map(mapTask)
  }
}
