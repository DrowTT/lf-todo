import { ipcMain } from 'electron'
import * as db from './db/database'

/**
 * 注册所有数据库相关的 IPC 处理器。
 * 在 app.whenReady() 后、createWindow() 前调用一次即可。
 */
export function registerIpcHandlers(): void {
  // ─── Category ──────────────────────────────────────────────────
  ipcMain.handle('db:get-categories', async () => db.getAllCategories())
  ipcMain.handle('db:create-category', async (_, name: string) => db.createCategory(name))
  ipcMain.handle('db:update-category', async (_, id: number, name: string) =>
    db.updateCategory(id, name)
  )
  ipcMain.handle('db:delete-category', async (_, id: number) => db.deleteCategory(id))

  // ─── Task ───────────────────────────────────────────────────────
  ipcMain.handle('db:get-tasks', async (_, categoryId: number) => db.getTasksByCategory(categoryId))
  ipcMain.handle('db:create-task', async (_, content: string, categoryId: number) =>
    db.createTask(content, categoryId)
  )
  ipcMain.handle('db:update-task', async (_, id: number, updates: any) =>
    db.updateTask(id, updates)
  )
  ipcMain.handle('db:delete-task', async (_, id: number) => db.deleteTask(id))
  ipcMain.handle('db:toggle-task', async (_, id: number) => db.toggleTaskComplete(id))
  ipcMain.handle('db:delete-tasks', async (_, ids: number[]) => db.deleteTasks(ids))
  ipcMain.handle('db:get-pending-counts', async () => db.getPendingTaskCounts())

  // ─── SubTask ────────────────────────────────────────────────────
  ipcMain.handle('db:get-subtasks', async (_, parentId: number) => db.getSubTasks(parentId))
  ipcMain.handle('db:create-subtask', async (_, content: string, parentId: number) =>
    db.createSubTask(content, parentId)
  )
}
