import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database | null = null

/**
 * 获取已初始化的数据库实例，未初始化时抛出错误
 * 消除各函数中重复的 if (!db) throw 判断（优化 #12）
 */
function getDb(): Database.Database {
  if (!db) throw new Error('数据库未初始化')
  return db
}

/**
 * 初始化数据库并创建表结构
 */
export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'lite-todo.db')

  db = new Database(dbPath)

  // 启用外键约束
  db.pragma('foreign_keys = ON')

  // 创建分类表
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `)

  // 创建任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      category_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `)

  // 对已有数据库做字段迁移（parent_id 可能不存在）
  const columns = db.pragma('table_info(tasks)') as { name: string }[]
  const hasParentId = columns.some((col) => col.name === 'parent_id')
  if (!hasParentId) {
    db.exec('ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE')
    console.log('迁移成功: tasks 表已添加 parent_id 字段')
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

/**
 * 获取所有分类
 */
export function getAllCategories(): Category[] {
  const stmt = getDb().prepare('SELECT * FROM categories ORDER BY order_index, id')
  return stmt.all() as Category[]
}

/**
 * 创建分类
 */
export function createCategory(name: string): Category {
  const stmt = getDb().prepare('INSERT INTO categories (name) VALUES (?)')
  const info = stmt.run(name)
  return getCategoryById(info.lastInsertRowid as number)!
}

/**
 * 根据 ID 获取分类
 */
export function getCategoryById(id: number): Category | undefined {
  const stmt = getDb().prepare('SELECT * FROM categories WHERE id = ?')
  return stmt.get(id) as Category | undefined
}

/**
 * 更新分类
 */
export function updateCategory(id: number, name: string): void {
  const stmt = getDb().prepare('UPDATE categories SET name = ? WHERE id = ?')
  stmt.run(name, id)
}

/**
 * 删除分类（级联删除关联任务）
 */
export function deleteCategory(id: number): void {
  const stmt = getDb().prepare('DELETE FROM categories WHERE id = ?')
  stmt.run(id)
}

// ==================== Task CRUD ====================

export interface Task {
  id: number
  content: string
  /** SQLite 存 0/1，查询出口统一映射为 boolean（优化 #1） */
  is_completed: boolean
  category_id: number
  order_index: number
  created_at: number
  parent_id: number | null
  // 子任务统计（仅顶级任务具备）
  subtask_total: number
  subtask_done: number
}

/**
 * 将数据库原始行映射为类型安全的 Task 对象
 * better-sqlite3 不自动转换 boolean，在此统一处理（优化 #1）
 */
function mapTask(raw: Record<string, unknown>): Task {
  return {
    ...(raw as Omit<Task, 'is_completed'>),
    is_completed: raw.is_completed === 1
  }
}

/**
 * 根据分类 ID 获取任务列表
 */
export function getTasksByCategory(categoryId: number): Task[] {
  // LEFT JOIN 带出子任务统计，初始加载即可显示进度 badge
  const stmt = getDb().prepare(`
    SELECT t.*,
      COUNT(s.id) AS subtask_total,
      SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS subtask_done
    FROM tasks t
    LEFT JOIN tasks s ON s.parent_id = t.id
    WHERE t.category_id = ? AND t.parent_id IS NULL
    GROUP BY t.id
    ORDER BY t.order_index DESC, t.id DESC
  `)
  return (stmt.all(categoryId) as Record<string, unknown>[]).map(mapTask)
}

/**
 * 获取指定父任务的子任务列表
 */
export function getSubTasks(parentId: number): Task[] {
  const stmt = getDb().prepare(
    'SELECT * FROM tasks WHERE parent_id = ? ORDER BY order_index ASC, id ASC'
  )
  return (stmt.all(parentId) as Record<string, unknown>[]).map(mapTask)
}

/**
 * 创建子任务
 */
export function createSubTask(content: string, parentId: number): Task {
  // 继承父任务的 category_id
  const parent = getTaskById(parentId)
  if (!parent) throw new Error(`父任务 ${parentId} 不存在`)
  const stmt = getDb().prepare(
    'INSERT INTO tasks (content, category_id, parent_id) VALUES (?, ?, ?)'
  )
  const info = stmt.run(content, parent.category_id, parentId)
  return getTaskById(info.lastInsertRowid as number)!
}

/**
 * 创建任务
 */
export function createTask(content: string, categoryId: number): Task {
  const stmt = getDb().prepare('INSERT INTO tasks (content, category_id) VALUES (?, ?)')
  const info = stmt.run(content, categoryId)
  return getTaskById(info.lastInsertRowid as number)!
}

/**
 * 根据 ID 获取任务
 */
export function getTaskById(id: number): Task | undefined {
  const stmt = getDb().prepare('SELECT * FROM tasks WHERE id = ?')
  const raw = stmt.get(id)
  return raw ? mapTask(raw as Record<string, unknown>) : undefined
}

// ─── updateTask 独立 prepare 语句（优化 #13，避免动态拼 SQL 导致 prepared cache 失效）
// 延迟初始化，避免在 db 未就绪时执行
let _stmtUpdateContent: Database.Statement | null = null
let _stmtUpdateIsCompleted: Database.Statement | null = null
let _stmtUpdateOrderIndex: Database.Statement | null = null

function getUpdateContentStmt(): Database.Statement {
  if (!_stmtUpdateContent)
    _stmtUpdateContent = getDb().prepare('UPDATE tasks SET content = ? WHERE id = ?')
  return _stmtUpdateContent
}

function getUpdateIsCompletedStmt(): Database.Statement {
  if (!_stmtUpdateIsCompleted)
    _stmtUpdateIsCompleted = getDb().prepare('UPDATE tasks SET is_completed = ? WHERE id = ?')
  return _stmtUpdateIsCompleted
}

function getUpdateOrderIndexStmt(): Database.Statement {
  if (!_stmtUpdateOrderIndex)
    _stmtUpdateOrderIndex = getDb().prepare('UPDATE tasks SET order_index = ? WHERE id = ?')
  return _stmtUpdateOrderIndex
}

/**
 * 更新任务（拆分为独立 prepare 语句以复用缓存）
 */
export function updateTask(
  id: number,
  updates: Partial<Pick<Task, 'content' | 'is_completed' | 'order_index'>>
): void {
  if (updates.content !== undefined) {
    getUpdateContentStmt().run(updates.content, id)
  }
  if (updates.is_completed !== undefined) {
    // 写入时将 boolean 转回 SQLite INTEGER（优化 #1）
    getUpdateIsCompletedStmt().run(updates.is_completed ? 1 : 0, id)
  }
  if (updates.order_index !== undefined) {
    getUpdateOrderIndexStmt().run(updates.order_index, id)
  }
}

/**
 * 删除任务
 */
export function deleteTask(id: number): void {
  const stmt = getDb().prepare('DELETE FROM tasks WHERE id = ?')
  stmt.run(id)
}

/**
 * 批量删除任务（优化 #14：改用 IN 子句，比事务循环更简洁）
 */
export function deleteTasks(ids: number[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  getDb()
    .prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`)
    .run(...ids)
}

/**
 * 切换任务完成状态
 */
export function toggleTaskComplete(id: number): void {
  const stmt = getDb().prepare('UPDATE tasks SET is_completed = NOT is_completed WHERE id = ?')
  stmt.run(id)
}

/**
 * 获取各分类的待完成任务数量
 * 返回 { categoryId: pendingCount } 的映射
 */
export function getPendingTaskCounts(): Record<number, number> {
  // 只统计顶级任务（parent_id IS NULL）
  const stmt = getDb().prepare(
    'SELECT category_id, COUNT(*) as count FROM tasks WHERE is_completed = 0 AND parent_id IS NULL GROUP BY category_id'
  )
  const rows = stmt.all() as { category_id: number; count: number }[]
  const result: Record<number, number> = {}
  for (const row of rows) {
    result[row.category_id] = row.count
  }
  return result
}
