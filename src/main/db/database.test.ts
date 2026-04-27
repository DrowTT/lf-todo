import { beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDatabase, createTask, initDatabase } from './database'

const mockState = vi.hoisted(() => ({
  preparedSql: [] as string[],
  createTaskRun: vi.fn(),
  getTaskByIdGet: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'mock-user-data')
  }
}))

vi.mock('better-sqlite3', () => {
  class MockDatabase {
    pragma(value: string) {
      if (value === 'user_version') {
        return [{ user_version: 13 }]
      }

      return []
    }

    prepare(sql: string) {
      mockState.preparedSql.push(sql)

      if (sql.includes('INSERT INTO tasks (content, category_id, order_index')) {
        return {
          run: mockState.createTaskRun.mockReturnValue({ lastInsertRowid: 42 })
        }
      }

      if (sql.includes('WHERE t.id = ?')) {
        return {
          get: mockState.getTaskByIdGet.mockReturnValue({
            id: 42,
            content: '新待办',
            description: null,
            is_completed: 0,
            category_id: 7,
            order_index: 3,
            created_at: 1,
            completed_at: null,
            last_restored_at: null,
            parent_id: null,
            due_at: null,
            due_precision: null,
            priority: 'medium',
            subtask_total: 0,
            subtask_done: 0
          })
        }
      }

      return {
        all: vi.fn().mockReturnValue([]),
        get: vi.fn(),
        run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 1 })
      }
    }

    exec() {
      return undefined
    }

    transaction<T extends (...args: never[]) => unknown>(callback: T) {
      return callback
    }

    close() {
      return undefined
    }
  }

  return {
    default: MockDatabase
  }
})

describe('database 任务排序', () => {
  beforeEach(() => {
    mockState.preparedSql = []
    mockState.createTaskRun.mockClear()
    mockState.getTaskByIdGet.mockClear()
    closeDatabase()
  })

  it('创建根待办时使用分类内下一个顶部排序值', () => {
    initDatabase()

    createTask({
      content: '新待办',
      categoryId: 7,
      due_at: null,
      due_precision: null,
      priority: 'medium'
    })

    const createTaskSql = mockState.preparedSql.find((sql) =>
      sql.includes('INSERT INTO tasks (content, category_id, order_index')
    )

    expect(createTaskSql).toContain('MAX(order_index) + 1')
    expect(createTaskSql).toContain('category_id = ? AND parent_id IS NULL')
    expect(mockState.createTaskRun).toHaveBeenCalledWith('新待办', 7, 7, null, null, 'medium')
  })
})
