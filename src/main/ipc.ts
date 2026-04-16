import { ipcMain } from 'electron'
import * as db from './db/database'
import {
  parseCreateSubTaskRequest,
  parseCreateTaskRequest,
  parseDeleteTasksRequest,
  parseQuickAddSubmitRequest,
  parseReorderTasksRequest,
  parseSearchTasksRequest,
  parseSetTaskCompletedRequest,
  parseUpdateTaskRequest
} from '../shared/contracts/db'
import { DEFAULT_TASK_PRIORITY } from '../shared/constants/task'
import { expectInteger, expectString } from '../shared/contracts/utils'
import type { QuickAddCommittedEvent } from '../shared/types/models'

interface RegisterIpcHandlersOptions {
  onQuickAddCommitted?: (payload: QuickAddCommittedEvent) => void
}

export function registerIpcHandlers(options: RegisterIpcHandlersOptions = {}): void {
  ipcMain.handle('db:get-categories', () => db.getAllCategories())
  ipcMain.handle('db:create-category', (_event, name: unknown) =>
    db.createCategory(
      expectString(name, 'db:create-category.request.name', { trim: true, minLength: 1 })
    )
  )
  ipcMain.handle('db:update-category', (_event, id: unknown, name: unknown) =>
    db.updateCategory(
      expectInteger(id, 'db:update-category.request.id', { min: 1 }),
      expectString(name, 'db:update-category.request.name', { trim: true, minLength: 1 })
    )
  )
  ipcMain.handle('db:delete-category', (_event, id: unknown) =>
    db.deleteCategory(expectInteger(id, 'db:delete-category.request.id', { min: 1 }))
  )

  ipcMain.handle('db:get-tasks', (_event, categoryId: unknown) =>
    db.getTasksByCategory(expectInteger(categoryId, 'db:get-tasks.request.categoryId', { min: 1 }))
  )
  ipcMain.handle('db:search-tasks', (_event, payload: unknown) => {
    const request = parseSearchTasksRequest(payload, 'db:search-tasks.request')
    return db.searchTasks(request)
  })
  ipcMain.handle('db:create-task', (_event, payload: unknown) => {
    const request = parseCreateTaskRequest(payload, 'db:create-task.request')
    return db.createTask(request)
  })
  ipcMain.handle('quick-add:submit', (_event, payload: unknown) => {
    const request = parseQuickAddSubmitRequest(payload, 'quick-add:submit.request')
    const normalizedCategoryName = request.categoryName?.trim().toLocaleLowerCase() ?? null

    const category =
      request.categoryId !== null
        ? db.getCategoryById(request.categoryId)
        : db
            .getAllCategories()
            .find((item) => item.name.trim().toLocaleLowerCase() === normalizedCategoryName)
    if (request.categoryId !== null && !category) {
      throw new Error('quick-add:submit.request.categoryId does not exist')
    }

    const resolvedCategory =
      category ??
      db.createCategory(
        expectString(request.categoryName, 'quick-add:submit.request.categoryName', {
          trim: true,
          minLength: 1,
          maxLength: 64
        })
      )
    const task = db.createTask({
      content: request.content,
      categoryId: resolvedCategory.id,
      due_at: null,
      due_precision: null,
      priority: DEFAULT_TASK_PRIORITY
    })
    const categoryCreated = request.categoryId === null && category === undefined

    options.onQuickAddCommitted?.({
      categoryId: resolvedCategory.id,
      categoryCreated
    })

    return {
      task,
      category: resolvedCategory,
      categoryCreated
    }
  })
  ipcMain.handle('db:update-task', (_event, payload: unknown) => {
    const request = parseUpdateTaskRequest(payload, 'db:update-task.request')
    return db.updateTask(request.id, request.updates)
  })
  ipcMain.handle('db:delete-task', (_event, id: unknown) =>
    db.deleteTask(expectInteger(id, 'db:delete-task.request.id', { min: 1 }))
  )
  ipcMain.handle('db:toggle-task', (_event, id: unknown) =>
    db.toggleTaskComplete(expectInteger(id, 'db:toggle-task.request.id', { min: 1 }))
  )
  ipcMain.handle('db:set-task-completed', (_event, payload: unknown) => {
    const request = parseSetTaskCompletedRequest(payload, 'db:set-task-completed.request')
    return db.setTaskCompleted(request.id, request.completed)
  })
  ipcMain.handle('db:delete-tasks', (_event, payload: unknown) => {
    const request = parseDeleteTasksRequest(payload, 'db:delete-tasks.request')
    return db.deleteTasks(request.ids)
  })
  ipcMain.handle('db:get-pending-counts', () => db.getPendingTaskCounts())
  ipcMain.handle('db:clear-completed-tasks', (_event, categoryId: unknown) =>
    db.clearCompletedTasks(
      expectInteger(categoryId, 'db:clear-completed-tasks.request.categoryId', { min: 1 })
    )
  )
  ipcMain.handle('db:reorder-tasks', (_event, payload: unknown) => {
    const request = parseReorderTasksRequest(payload, 'db:reorder-tasks.request')
    return db.reorderTasks(request.orderedIds)
  })
  ipcMain.handle('db:reorder-subtasks', (_event, payload: unknown) => {
    const request = parseReorderTasksRequest(payload, 'db:reorder-subtasks.request')
    return db.reorderSubTasks(request.orderedIds)
  })

  ipcMain.handle('db:get-subtasks', (_event, parentId: unknown) =>
    db.getSubTasks(expectInteger(parentId, 'db:get-subtasks.request.parentId', { min: 1 }))
  )
  ipcMain.handle('db:create-subtask', (_event, payload: unknown) => {
    const request = parseCreateSubTaskRequest(payload, 'db:create-subtask.request')
    return db.createSubTask(request.content, request.parentId)
  })
  ipcMain.handle('db:batch-complete-subtasks', (_event, parentId: unknown) =>
    db.batchCompleteSubTasks(
      expectInteger(parentId, 'db:batch-complete-subtasks.request.parentId', { min: 1 })
    )
  )
}
