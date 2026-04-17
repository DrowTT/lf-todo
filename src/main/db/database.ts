import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { SYSTEM_CATEGORY_NAME, SYSTEM_CATEGORY_ORDER_INDEX } from '../../shared/constants/category'
import { DEFAULT_TASK_PRIORITY } from '../../shared/constants/task'
import type { SearchTasksRequest } from '../../shared/contracts/db'
import type {
  ArchivedTaskGroup,
  TaskCreateInput,
  TaskDuePrecision,
  TaskDueState,
  TaskPriority,
  TaskUpdate
} from '../../shared/types/models'

let db: Database.Database | null = null
let stmts: Record<string, Database.Statement> | null = null

interface Migration {
  version: number
  description: string
  up: string
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'create categories table',
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
    description: 'create tasks table',
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
    description: 'backfill parent_id column for legacy tasks table',
    up: `ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE`
  },
  {
    version: 4,
    description: 'add task indexes',
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
  },
  {
    version: 8,
    description: 'add is_system column to categories',
    up: `ALTER TABLE categories ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0`
  },
  {
    version: 9,
    description: 'ensure system inbox category exists',
    up: `
      UPDATE categories SET order_index = order_index + 1;

      INSERT INTO categories (name, order_index, is_system)
      SELECT '${SYSTEM_CATEGORY_NAME}', ${SYSTEM_CATEGORY_ORDER_INDEX}, 1
      WHERE NOT EXISTS (
        SELECT 1 FROM categories WHERE TRIM(name) = '${SYSTEM_CATEGORY_NAME}'
      );

      UPDATE categories
      SET is_system = CASE
        WHEN id = (
          SELECT id
          FROM categories
          WHERE TRIM(name) = '${SYSTEM_CATEGORY_NAME}'
          ORDER BY order_index ASC, id ASC
          LIMIT 1
        ) THEN 1
        ELSE 0
      END;

      UPDATE categories
      SET order_index = ${SYSTEM_CATEGORY_ORDER_INDEX}
      WHERE is_system = 1;
    `
  },
  {
    version: 10,
    description: 'add task archive schema',
    up: `
      ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
      ALTER TABLE tasks ADD COLUMN last_restored_at INTEGER;

      CREATE INDEX IF NOT EXISTS idx_tasks_completed_archive ON tasks(is_completed, parent_id, completed_at, last_restored_at);

      CREATE TABLE IF NOT EXISTS archived_tasks (
        id INTEGER PRIMARY KEY,
        content TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 1,
        category_id INTEGER NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        last_restored_at INTEGER,
        archived_at INTEGER NOT NULL,
        archived_category_name TEXT,
        parent_id INTEGER,
        due_at INTEGER,
        due_precision TEXT,
        priority TEXT NOT NULL DEFAULT '${DEFAULT_TASK_PRIORITY}'
      );

      CREATE INDEX IF NOT EXISTS idx_archived_tasks_parent ON archived_tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_archived_tasks_archived_at ON archived_tasks(archived_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_archived_tasks_category ON archived_tasks(category_id);
    `
  }
]

function getDb(): Database.Database {
  if (!db) {
    throw new Error('database is not initialized')
  }

  return db
}

function getStmts() {
  if (!stmts) {
    throw new Error('database statements are not initialized')
  }

  return stmts
}

function runMigrations(database: Database.Database): void {
  const currentVersion = (database.pragma('user_version') as { user_version: number }[])[0]
    .user_version
  const pending = migrations.filter((migration) => migration.version > currentVersion)

  for (const migration of pending) {
    database.transaction(() => {
      const statements = migration.up
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)

      for (const statement of statements) {
        try {
          database.exec(statement)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (!message.includes('duplicate column name')) {
            throw error
          }
        }
      }

      database.pragma(`user_version = ${migration.version}`)
      console.log(`[DB migration] v${migration.version}: ${migration.description}`)
    })()
  }
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'lite-todo.db')

  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  runMigrations(db)

  stmts = {
    getAllCategories: db.prepare('SELECT * FROM categories ORDER BY order_index, id'),
    getCategoryById: db.prepare('SELECT * FROM categories WHERE id = ?'),
    getSystemCategory: db.prepare('SELECT * FROM categories WHERE is_system = 1 ORDER BY id LIMIT 1'),
    createCategory: db.prepare(`
      INSERT INTO categories (name, order_index, is_system)
      VALUES (?, COALESCE((SELECT MAX(order_index) + 1 FROM categories), 1), 0)
    `),
    updateCategory: db.prepare('UPDATE categories SET name = ? WHERE id = ?'),
    deleteCategory: db.prepare('DELETE FROM categories WHERE id = ?'),
    findCategoryByName: db.prepare('SELECT * FROM categories WHERE LOWER(TRIM(name)) = ? ORDER BY id LIMIT 1'),
    getTasksByCategory: db.prepare(`
      SELECT
        t.*,
        COUNT(s.id) AS subtask_total,
        SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS subtask_done
      FROM tasks t
      LEFT JOIN tasks s ON s.parent_id = t.id
      WHERE t.category_id = ? AND t.parent_id IS NULL
      GROUP BY t.id
      ORDER BY t.order_index DESC, t.id DESC
    `),
    getAllRootTasks: db.prepare(`
      SELECT
        t.*,
        COUNT(s.id) AS subtask_total,
        SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS subtask_done
      FROM tasks t
      LEFT JOIN tasks s ON s.parent_id = t.id
      WHERE t.parent_id IS NULL
      GROUP BY t.id
      ORDER BY t.order_index DESC, t.id DESC
    `),
    getSubTasks: db.prepare(
      'SELECT * FROM tasks WHERE parent_id = ? ORDER BY order_index ASC, id ASC'
    ),
    getTaskById: db.prepare(`
      SELECT
        t.*,
        COUNT(s.id) AS subtask_total,
        SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS subtask_done
      FROM tasks t
      LEFT JOIN tasks s ON s.parent_id = t.id
      WHERE t.id = ?
      GROUP BY t.id
    `),
    getTaskRowById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
    getTaskTreeRows: db.prepare(`
      SELECT * FROM tasks
      WHERE id = ? OR parent_id = ?
      ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END ASC, order_index ASC, id ASC
    `),
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
    updateCompleted: db.prepare(`
      UPDATE tasks
      SET
        is_completed = ?,
        completed_at = CASE WHEN ? = 1 THEN CAST(strftime('%s', 'now') AS INTEGER) ELSE NULL END,
        last_restored_at = NULL
      WHERE id = ?
    `),
    updateOrderIndex: db.prepare('UPDATE tasks SET order_index = ? WHERE id = ?'),
    updateDueAt: db.prepare('UPDATE tasks SET due_at = ? WHERE id = ?'),
    updateDuePrecision: db.prepare('UPDATE tasks SET due_precision = ? WHERE id = ?'),
    updatePriority: db.prepare('UPDATE tasks SET priority = ? WHERE id = ?'),
    deleteTask: db.prepare('DELETE FROM tasks WHERE id = ?'),
    batchCompleteSubTasks: db.prepare(`
      UPDATE tasks
      SET
        is_completed = 1,
        completed_at = CAST(strftime('%s', 'now') AS INTEGER),
        last_restored_at = NULL
      WHERE parent_id = ? AND is_completed = 0
    `),
    getPendingTaskCounts: db.prepare(`
      SELECT category_id, COUNT(*) AS count
      FROM tasks
      WHERE is_completed = 0 AND parent_id IS NULL
      GROUP BY category_id
    `),
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
    insertArchivedTask: db.prepare(`
      INSERT INTO archived_tasks (
        id,
        content,
        is_completed,
        category_id,
        order_index,
        created_at,
        completed_at,
        last_restored_at,
        archived_at,
        archived_category_name,
        parent_id,
        due_at,
        due_precision,
        priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getArchivedRootTasks: db.prepare(`
      SELECT
        t.*,
        COUNT(s.id) AS subtask_total,
        SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS subtask_done
      FROM archived_tasks t
      LEFT JOIN archived_tasks s ON s.parent_id = t.id
      WHERE t.parent_id IS NULL
      GROUP BY t.id
      ORDER BY t.archived_at DESC, t.completed_at DESC, t.id DESC
    `),
    getArchivedSubTasks: db.prepare(
      'SELECT * FROM archived_tasks WHERE parent_id = ? ORDER BY order_index ASC, id ASC'
    ),
    getArchivedTaskRowById: db.prepare('SELECT * FROM archived_tasks WHERE id = ?'),
    getArchivedTaskTreeRows: db.prepare(`
      SELECT * FROM archived_tasks
      WHERE id = ? OR parent_id = ?
      ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END ASC, order_index ASC, id ASC
    `),
    deleteArchivedTaskTree: db.prepare('DELETE FROM archived_tasks WHERE id = ? OR parent_id = ?'),
    insertRestoredTask: db.prepare(`
      INSERT INTO tasks (
        id,
        content,
        is_completed,
        category_id,
        order_index,
        created_at,
        completed_at,
        last_restored_at,
        parent_id,
        due_at,
        due_precision,
        priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
  }

  console.log('database initialized:', dbPath)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    stmts = null
  }
}

export interface Category {
  id: number
  name: string
  is_system: boolean
  order_index: number
  created_at: number
}

export interface Task extends TaskDueState {
  id: number
  content: string
  is_completed: boolean
  category_id: number
  order_index: number
  created_at: number
  completed_at: number | null
  last_restored_at: number | null
  parent_id: number | null
  priority: TaskPriority
  archived_at?: number | null
  archived_category_name?: string | null
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

function mapCategory(raw: Record<string, unknown>): Category {
  return {
    id: raw.id as number,
    name: raw.name as string,
    is_system: raw.is_system === 1 || raw.is_system === true,
    order_index: raw.order_index as number,
    created_at: raw.created_at as number
  }
}

function mapTask(raw: Record<string, unknown>): Task {
  return {
    id: raw.id as number,
    content: raw.content as string,
    is_completed: raw.is_completed === 1 || raw.is_completed === true,
    category_id: raw.category_id as number,
    order_index: raw.order_index as number,
    created_at: raw.created_at as number,
    completed_at: typeof raw.completed_at === 'number' ? raw.completed_at : null,
    last_restored_at: typeof raw.last_restored_at === 'number' ? raw.last_restored_at : null,
    parent_id: typeof raw.parent_id === 'number' ? raw.parent_id : null,
    due_at: typeof raw.due_at === 'number' ? raw.due_at : null,
    due_precision: (raw.due_precision as TaskDuePrecision | null | undefined) ?? null,
    priority: (raw.priority as TaskPriority | null | undefined) ?? DEFAULT_TASK_PRIORITY,
    archived_at: typeof raw.archived_at === 'number' ? raw.archived_at : null,
    archived_category_name:
      typeof raw.archived_category_name === 'string' ? raw.archived_category_name : null,
    subtask_total: typeof raw.subtask_total === 'number' ? raw.subtask_total : 0,
    subtask_done: typeof raw.subtask_done === 'number' ? raw.subtask_done : 0
  }
}

function normalizeCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function getSystemCategory(): Category | undefined {
  const raw = getStmts().getSystemCategory.get() as Record<string, unknown> | undefined
  return raw ? mapCategory(raw) : undefined
}

function ensureCategoryMutable(id: number): Category {
  const category = getCategoryById(id)

  if (!category) {
    throw new Error(`Category ${id} does not exist`)
  }

  if (category.is_system) {
    throw new Error('System category cannot be modified')
  }

  return category
}

function assertCategoryNameAllowed(name: string, currentCategoryId?: number): void {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Category name is required')
  }

  const normalizedName = normalizeCategoryName(trimmedName)
  const duplicated = getAllCategories().find((category) => normalizeCategoryName(category.name) === normalizedName)

  if (duplicated && duplicated.id !== currentCategoryId) {
    throw new Error('Category name already exists')
  }

  if (normalizedName !== normalizeCategoryName(SYSTEM_CATEGORY_NAME)) {
    return
  }

  const systemCategory = getSystemCategory()
  if (systemCategory && systemCategory.id !== currentCategoryId) {
    throw new Error('System category name is reserved')
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function getCategoryNameSnapshot(categoryId: number): string | null {
  return getCategoryById(categoryId)?.name ?? '未知分类'
}

function mapRows(rows: Record<string, unknown>[]): Task[] {
  return rows.map(mapTask)
}

function getTaskRows(parentId: number): Record<string, unknown>[] {
  return getStmts().getTaskTreeRows.all(parentId, parentId) as Record<string, unknown>[]
}

function getArchivedTaskRows(parentId: number): Record<string, unknown>[] {
  return getStmts().getArchivedTaskTreeRows.all(parentId, parentId) as Record<string, unknown>[]
}

function archiveTaskTree(parentId: number, archivedAt: number): void {
  const rows = getTaskRows(parentId)
  if (rows.length === 0) {
    return
  }

  const parentRow = rows.find((row) => row.parent_id === null)
  if (!parentRow) {
    throw new Error(`Task ${parentId} is not a root task`)
  }

  const archivedCategoryName = getCategoryNameSnapshot(parentRow.category_id as number)

  for (const row of rows) {
    getStmts().insertArchivedTask.run(
      row.id,
      row.content,
      row.is_completed,
      row.category_id,
      row.order_index,
      row.created_at,
      row.completed_at ?? null,
      row.last_restored_at ?? null,
      archivedAt,
      archivedCategoryName,
      row.parent_id ?? null,
      row.due_at ?? null,
      row.due_precision ?? null,
      row.priority ?? DEFAULT_TASK_PRIORITY
    )
  }

  getStmts().deleteTask.run(parentId)
}

function assertTaskTreeArchivable(parentId: number): void {
  const rows = getTaskRows(parentId)
  if (rows.length === 0) {
    throw new Error(`Task ${parentId} does not exist`)
  }

  const parentRow = rows.find((row) => row.parent_id === null)
  if (!parentRow) {
    throw new Error(`Task ${parentId} is not a root task`)
  }

  const parentCompleted = parentRow.is_completed === 1 || parentRow.is_completed === true
  if (!parentCompleted) {
    throw new Error(`Task ${parentId} is not completed`)
  }

  const hasIncompleteSubTask = rows.some(
    (row) => row.parent_id !== null && !(row.is_completed === 1 || row.is_completed === true)
  )
  if (hasIncompleteSubTask) {
    throw new Error(`Task ${parentId} has incomplete subtasks`)
  }
}

function isValidRestorableCategoryName(name: string | null | undefined): name is string {
  if (!name) {
    return false
  }

  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 64) {
    return false
  }

  return normalizeCategoryName(trimmed) !== normalizeCategoryName(SYSTEM_CATEGORY_NAME)
}

function resolveRestoreCategoryId(row: Record<string, unknown>): number {
  const originalCategoryId = row.category_id as number
  const originalCategory = getCategoryById(originalCategoryId)
  if (originalCategory) {
    return originalCategory.id
  }

  const archivedCategoryName =
    typeof row.archived_category_name === 'string' ? row.archived_category_name.trim() : ''

  if (archivedCategoryName) {
    const matched = getStmts().findCategoryByName.get(
      normalizeCategoryName(archivedCategoryName)
    ) as Record<string, unknown> | undefined

    if (matched) {
      return mapCategory(matched).id
    }

    if (isValidRestorableCategoryName(archivedCategoryName)) {
      return createCategory(archivedCategoryName).id
    }
  }

  return getSystemCategory()?.id ?? getAllCategories()[0]?.id ?? createCategory('恢复任务').id
}

function restoreArchivedTaskTree(parentId: number, restoredAt: number): void {
  const rows = getArchivedTaskRows(parentId)
  if (rows.length === 0) {
    return
  }

  const parentRow = rows.find((row) => row.parent_id === null)
  if (!parentRow) {
    throw new Error(`Archived task ${parentId} is not a root task`)
  }

  const targetCategoryId = resolveRestoreCategoryId(parentRow)

  for (const row of rows) {
    getStmts().insertRestoredTask.run(
      row.id,
      row.content,
      row.is_completed,
      targetCategoryId,
      row.order_index,
      row.created_at,
      row.completed_at ?? null,
      restoredAt,
      row.parent_id ?? null,
      row.due_at ?? null,
      row.due_precision ?? null,
      row.priority ?? DEFAULT_TASK_PRIORITY
    )
  }

  getStmts().deleteArchivedTaskTree.run(parentId, parentId)
}

export function getAllCategories(): Category[] {
  return (getStmts().getAllCategories.all() as Record<string, unknown>[]).map(mapCategory)
}

export function createCategory(name: string): Category {
  assertCategoryNameAllowed(name)
  const info = getStmts().createCategory.run(name)
  return getCategoryById(info.lastInsertRowid as number)!
}

export function getCategoryById(id: number): Category | undefined {
  const raw = getStmts().getCategoryById.get(id) as Record<string, unknown> | undefined
  return raw ? mapCategory(raw) : undefined
}

export function updateCategory(id: number, name: string): void {
  ensureCategoryMutable(id)
  assertCategoryNameAllowed(name, id)
  getStmts().updateCategory.run(name, id)
}

export function deleteCategory(id: number): void {
  ensureCategoryMutable(id)
  getStmts().deleteCategory.run(id)
}

export function getTasksByCategory(categoryId: number): Task[] {
  const category = getCategoryById(categoryId)
  const rows = category?.is_system
    ? (getStmts().getAllRootTasks.all() as Record<string, unknown>[])
    : (getStmts().getTasksByCategory.all(categoryId) as Record<string, unknown>[])

  return mapRows(rows)
}

export function searchTasks(request: SearchTasksRequest): Task[] {
  const normalizedQuery = request.query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return []
  }

  const escapedQuery = escapeLikePattern(normalizedQuery)
  const likePattern = `%${escapedQuery}%`
  const prefixPattern = `${escapedQuery}%`
  const categoryId =
    request.categoryId === null || getCategoryById(request.categoryId)?.is_system
      ? null
      : request.categoryId

  const sql = `
    SELECT
      t.*,
      COUNT(s.id) AS subtask_total,
      SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS subtask_done
    FROM tasks t
    LEFT JOIN tasks s ON s.parent_id = t.id
    WHERE
      t.parent_id IS NULL
      AND LOWER(t.content) LIKE @likePattern ESCAPE '\\'
      ${categoryId === null ? '' : 'AND t.category_id = @categoryId'}
    GROUP BY t.id
    ORDER BY
      CASE WHEN LOWER(TRIM(t.content)) = @exactQuery THEN 0 ELSE 1 END ASC,
      CASE WHEN LOWER(t.content) LIKE @prefixPattern ESCAPE '\\' THEN 0 ELSE 1 END ASC,
      CASE WHEN t.is_completed = 0 THEN 0 ELSE 1 END ASC,
      CASE
        WHEN t.priority = 'high' THEN 0
        WHEN t.priority = 'medium' THEN 1
        ELSE 2
      END ASC,
      t.order_index DESC,
      t.created_at DESC,
      t.id DESC
    LIMIT @limit
  `

  const rows = getDb().prepare(sql).all({
    exactQuery: normalizedQuery,
    prefixPattern,
    likePattern,
    categoryId,
    limit: request.limit
  }) as Record<string, unknown>[]

  return mapRows(rows)
}

export function getSubTasks(parentId: number): Task[] {
  return mapRows(getStmts().getSubTasks.all(parentId) as Record<string, unknown>[])
}

export function getArchivedTaskGroups(): ArchivedTaskGroup[] {
  const parents = getStmts().getArchivedRootTasks.all() as Record<string, unknown>[]

  return parents.map((parent) => ({
    task: mapTask(parent),
    subTasks: mapRows(getStmts().getArchivedSubTasks.all(parent.id) as Record<string, unknown>[])
  }))
}

export function getDueReminderTasks(): DueReminderTask[] {
  return (getStmts().getDueReminderTasks.all() as Record<string, unknown>[]).map((row) => ({
    id: row.id as number,
    content: row.content as string,
    category_id: row.category_id as number,
    category_name: row.category_name as string,
    due_at: row.due_at as number,
    due_precision: row.due_precision as TaskDuePrecision
  }))
}

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
  const raw = getStmts().getTaskById.get(id) as Record<string, unknown> | undefined
  return raw ? mapTask(raw) : undefined
}

export function updateTask(id: number, updates: TaskUpdate): void {
  const s = getStmts()

  if (updates.content !== undefined) {
    s.updateContent.run(updates.content, id)
  }

  if (updates.is_completed !== undefined) {
    s.updateCompleted.run(updates.is_completed ? 1 : 0, updates.is_completed ? 1 : 0, id)
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

export function toggleTaskComplete(id: number): void {
  const row = getStmts().getTaskRowById.get(id) as Record<string, unknown> | undefined
  if (!row) {
    return
  }

  setTaskCompleted(id, !(row.is_completed === 1 || row.is_completed === true))
}

export function setTaskCompleted(id: number, completed: boolean): void {
  getStmts().updateCompleted.run(completed ? 1 : 0, completed ? 1 : 0, id)
}

export function batchCompleteSubTasks(parentId: number): number {
  const info = getStmts().batchCompleteSubTasks.run(parentId)
  return info.changes
}

export function getPendingTaskCounts(): Record<number, number> {
  const rows = getStmts().getPendingTaskCounts.all() as { category_id: number; count: number }[]
  const counts = Object.fromEntries(rows.map((row) => [row.category_id, row.count])) as Record<
    number,
    number
  >
  const systemCategory = getSystemCategory()

  if (systemCategory) {
    counts[systemCategory.id] = rows.reduce((sum, row) => sum + row.count, 0)
  }

  return counts
}

export function archiveCompletedTasks(categoryId: number): number {
  const category = getCategoryById(categoryId)
  const sql = category?.is_system
    ? `
      SELECT id
      FROM tasks
      WHERE
        parent_id IS NULL
        AND is_completed = 1
        AND NOT EXISTS (
          SELECT 1 FROM tasks s WHERE s.parent_id = tasks.id AND s.is_completed = 0
        )
      ORDER BY order_index DESC, id DESC
    `
    : `
      SELECT id
      FROM tasks
      WHERE
        category_id = ?
        AND parent_id IS NULL
        AND is_completed = 1
        AND NOT EXISTS (
          SELECT 1 FROM tasks s WHERE s.parent_id = tasks.id AND s.is_completed = 0
        )
      ORDER BY order_index DESC, id DESC
    `
  const rows = category?.is_system
    ? (getDb().prepare(sql).all() as { id: number }[])
    : (getDb().prepare(sql).all(categoryId) as { id: number }[])

  if (rows.length === 0) {
    return 0
  }

  const archivedAt = Math.floor(Date.now() / 1000)

  getDb().transaction(() => {
    for (const row of rows) {
      archiveTaskTree(row.id, archivedAt)
    }
  })()

  return rows.length
}

export function archiveTask(id: number): void {
  assertTaskTreeArchivable(id)

  const archivedAt = Math.floor(Date.now() / 1000)
  getDb().transaction(() => {
    archiveTaskTree(id, archivedAt)
  })()
}

export function archiveCompletedTasksBefore(timestamp: number): number {
  const rows = getDb()
    .prepare(`
      SELECT id
      FROM tasks
      WHERE
        parent_id IS NULL
        AND is_completed = 1
        AND NOT EXISTS (
          SELECT 1 FROM tasks s WHERE s.parent_id = tasks.id AND s.is_completed = 0
        )
        AND COALESCE(last_restored_at, completed_at) IS NOT NULL
        AND COALESCE(last_restored_at, completed_at) < ?
      ORDER BY id ASC
    `)
    .all(timestamp) as { id: number }[]

  if (rows.length === 0) {
    return 0
  }

  const archivedAt = Math.floor(Date.now() / 1000)

  getDb().transaction(() => {
    for (const row of rows) {
      archiveTaskTree(row.id, archivedAt)
    }
  })()

  return rows.length
}

export function restoreArchivedTasks(ids: number[]): number {
  if (ids.length === 0) {
    return 0
  }

  const restoredAt = Math.floor(Date.now() / 1000)
  let restoredCount = 0

  getDb().transaction(() => {
    for (const id of ids) {
      if (!getStmts().getArchivedTaskRowById.get(id)) {
        continue
      }

      restoreArchivedTaskTree(id, restoredAt)
      restoredCount += 1
    }
  })()

  return restoredCount
}

export function reorderTasks(orderedIds: number[]): void {
  reorderTaskIds(orderedIds, (index, total) => total - index)
}

export function reorderSubTasks(orderedIds: number[]): void {
  reorderTaskIds(orderedIds, (index) => index)
}

function reorderTaskIds(
  orderedIds: number[],
  resolveOrderIndex: (index: number, total: number) => number
): void {
  if (orderedIds.length === 0) {
    return
  }

  const total = orderedIds.length

  getDb().transaction(() => {
    for (let index = 0; index < total; index += 1) {
      getStmts().updateOrderIndex.run(resolveOrderIndex(index, total), orderedIds[index])
    }
  })()
}

export function clearCompletedTasks(categoryId: number): number {
  return archiveCompletedTasks(categoryId)
}

export function deleteCompletedTasksBefore(timestamp: number): number {
  return archiveCompletedTasksBefore(timestamp)
}

export function exportAllData(): {
  categories: Category[]
  tasks: Task[]
  archivedTasks: Task[]
} {
  const categories = getAllCategories()
  const tasks = mapRows(
    getDb()
      .prepare('SELECT * FROM tasks ORDER BY category_id, order_index DESC, id DESC')
      .all() as Record<string, unknown>[]
  )
  const archivedTasks = mapRows(
    getDb()
      .prepare('SELECT * FROM archived_tasks ORDER BY archived_at DESC, id DESC')
      .all() as Record<string, unknown>[]
  )

  return {
    categories,
    tasks,
    archivedTasks
  }
}
