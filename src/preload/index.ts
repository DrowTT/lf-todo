import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    toggleAlwaysOnTop: () => ipcRenderer.send('window:toggle-always-on-top'),
    onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => {
      ipcRenderer.on('window:always-on-top-changed', (_, flag) => callback(flag))
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
    toggleTaskComplete: (id: number) => ipcRenderer.invoke('db:toggle-task', id),
    getPendingTaskCounts: () => ipcRenderer.invoke('db:get-pending-counts')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
