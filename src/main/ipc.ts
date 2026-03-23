import { ipcMain } from 'electron'
import * as db from './db/database'
import type { Task } from './db/database'

/**
 * 注册所有数据库相关的 IPC 处理器。
 * 在 app.whenReady() 后、createWindow() 前调用一次即可。
 */
export function registerIpcHandlers(): void {
  // ─── Category ──────────────────────────────────────────────────
  ipcMain.handle('db:get-categories', () => db.getAllCategories())
  ipcMain.handle('db:create-category', (_, name: string) => db.createCategory(name))
  ipcMain.handle('db:update-category', (_, id: number, name: string) => db.updateCategory(id, name))
  ipcMain.handle('db:delete-category', (_, id: number) => db.deleteCategory(id))

  // ─── Task ───────────────────────────────────────────────────────
  ipcMain.handle('db:get-tasks', (_, categoryId: number) => db.getTasksByCategory(categoryId))
  ipcMain.handle('db:create-task', (_, content: string, categoryId: number) =>
    db.createTask(content, categoryId)
  )
  ipcMain.handle(
    'db:update-task',
    (_, id: number, updates: Partial<Pick<Task, 'content' | 'is_completed' | 'order_index'>>) =>
      db.updateTask(id, updates)
  )
  ipcMain.handle('db:delete-task', (_, id: number) => db.deleteTask(id))
  ipcMain.handle('db:toggle-task', (_, id: number) => db.toggleTaskComplete(id))
  ipcMain.handle('db:set-task-completed', (_, id: number, completed: boolean) =>
    db.setTaskCompleted(id, completed)
  )
  ipcMain.handle('db:delete-tasks', (_, ids: number[]) => db.deleteTasks(ids))
  ipcMain.handle('db:get-pending-counts', () => db.getPendingTaskCounts())
  ipcMain.handle('db:reorder-tasks', (_, orderedIds: number[]) => db.reorderTasks(orderedIds))

  // ─── SubTask ────────────────────────────────────────────────────
  ipcMain.handle('db:get-subtasks', (_, parentId: number) => db.getSubTasks(parentId))
  ipcMain.handle('db:create-subtask', (_, content: string, parentId: number) =>
    db.createSubTask(content, parentId)
  )
  ipcMain.handle('db:batch-complete-subtasks', (_, parentId: number) =>
    db.batchCompleteSubTasks(parentId)
  )
}
