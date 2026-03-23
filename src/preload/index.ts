import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    toggleAlwaysOnTop: () => ipcRenderer.send('window:toggle-always-on-top'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => {
      ipcRenderer.on('window:always-on-top-changed', (_, flag) => callback(flag))
    },
    onMaximizedChanged: (callback: (flag: boolean) => void) => {
      ipcRenderer.on('window:maximized-changed', (_, flag) => callback(flag))
    }
  },
  db: {
    // Category 操作
    getCategories: () => ipcRenderer.invoke('db:get-categories'),
    createCategory: (name: string) => ipcRenderer.invoke('db:create-category', name),
    updateCategory: (id: number, name: string) =>
      ipcRenderer.invoke('db:update-category', id, name),
    deleteCategory: (id: number) => ipcRenderer.invoke('db:delete-category', id),

    // Task 操作
    getTasks: (categoryId: number) => ipcRenderer.invoke('db:get-tasks', categoryId),
    createTask: (content: string, categoryId: number) =>
      ipcRenderer.invoke('db:create-task', content, categoryId),
    updateTask: (id: number, updates: any) => ipcRenderer.invoke('db:update-task', id, updates),
    deleteTask: (id: number) => ipcRenderer.invoke('db:delete-task', id),
    deleteTasks: (ids: number[]) => ipcRenderer.invoke('db:delete-tasks', ids),
    toggleTaskComplete: (id: number) => ipcRenderer.invoke('db:toggle-task', id),
    setTaskCompleted: (id: number, completed: boolean) =>
      ipcRenderer.invoke('db:set-task-completed', id, completed),
    getPendingTaskCounts: () => ipcRenderer.invoke('db:get-pending-counts'),
    reorderTasks: (orderedIds: number[]) => ipcRenderer.invoke('db:reorder-tasks', orderedIds),

    // SubTask 操作
    getSubTasks: (parentId: number) => ipcRenderer.invoke('db:get-subtasks', parentId),
    createSubTask: (content: string, parentId: number) =>
      ipcRenderer.invoke('db:create-subtask', content, parentId),
    batchCompleteSubTasks: (parentId: number) =>
      ipcRenderer.invoke('db:batch-complete-subtasks', parentId)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
// 仅暴露业务所需的最小 API（sandbox: true 模式的最佳实践）
// electronAPI 已移除，不再向渲染进程暴露原生 Node.js 能力
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
