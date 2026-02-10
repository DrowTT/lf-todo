import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database | null = null

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
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `)

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
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('SELECT * FROM categories ORDER BY order_index, id')
  return stmt.all() as Category[]
}

/**
 * 创建分类
 */
export function createCategory(name: string): Category {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)')
  const info = stmt.run(name)
  return getCategoryById(info.lastInsertRowid as number)!
}

/**
 * 根据 ID 获取分类
 */
export function getCategoryById(id: number): Category | undefined {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('SELECT * FROM categories WHERE id = ?')
  return stmt.get(id) as Category | undefined
}

/**
 * 更新分类
 */
export function updateCategory(id: number, name: string): void {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('UPDATE categories SET name = ? WHERE id = ?')
  stmt.run(name, id)
}

/**
 * 删除分类（级联删除关联任务）
 */
export function deleteCategory(id: number): void {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('DELETE FROM categories WHERE id = ?')
  stmt.run(id)
}

// ==================== Task CRUD ====================

export interface Task {
  id: number
  content: string
  is_completed: number
  category_id: number
  order_index: number
  created_at: number
}

/**
 * 根据分类 ID 获取任务列表
 */
export function getTasksByCategory(categoryId: number): Task[] {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('SELECT * FROM tasks WHERE category_id = ? ORDER BY id DESC')
  return stmt.all(categoryId) as Task[]
}

/**
 * 创建任务
 */
export function createTask(content: string, categoryId: number): Task {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('INSERT INTO tasks (content, category_id) VALUES (?, ?)')
  const info = stmt.run(content, categoryId)
  return getTaskById(info.lastInsertRowid as number)!
}

/**
 * 根据 ID 获取任务
 */
export function getTaskById(id: number): Task | undefined {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?')
  return stmt.get(id) as Task | undefined
}

/**
 * 更新任务
 */
export function updateTask(
  id: number,
  updates: Partial<Pick<Task, 'content' | 'is_completed' | 'order_index'>>
): void {
  if (!db) throw new Error('数据库未初始化')

  const fields: string[] = []
  const values: any[] = []

  if (updates.content !== undefined) {
    fields.push('content = ?')
    values.push(updates.content)
  }
  if (updates.is_completed !== undefined) {
    fields.push('is_completed = ?')
    values.push(updates.is_completed)
  }
  if (updates.order_index !== undefined) {
    fields.push('order_index = ?')
    values.push(updates.order_index)
  }

  if (fields.length === 0) return

  values.push(id)
  const stmt = db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`)
  stmt.run(...values)
}

/**
 * 删除任务
 */
export function deleteTask(id: number): void {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?')
  stmt.run(id)
}

/**
 * 切换任务完成状态
 */
export function toggleTaskComplete(id: number): void {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare('UPDATE tasks SET is_completed = NOT is_completed WHERE id = ?')
  stmt.run(id)
}

/**
 * 获取各分类的待完成任务数量
 * 返回 { categoryId: pendingCount } 的映射
 */
export function getPendingTaskCounts(): Record<number, number> {
  if (!db) throw new Error('数据库未初始化')
  const stmt = db.prepare(
    'SELECT category_id, COUNT(*) as count FROM tasks WHERE is_completed = 0 GROUP BY category_id'
  )
  const rows = stmt.all() as { category_id: number; count: number }[]
  const result: Record<number, number> = {}
  for (const row of rows) {
    result[row.category_id] = row.count
  }
  return result
}
