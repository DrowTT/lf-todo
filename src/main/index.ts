import { app, shell, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import trayIcon from '../../resources/tray-icon.png?asset'
import * as db from './db/database'
import Store from 'electron-store'

interface StoreType {
  windowBounds: {
    width: number
    height: number
    x: number
    y: number
  }
}

const store = new Store<StoreType>()

function createWindow(): void {
  // Restore window bounds
  const bounds = store.get('windowBounds')

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: bounds?.width || 900,
    height: bounds?.height || 670,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 400, // 最小宽度：左侧 100px + 右侧 300px
    minHeight: 500, // 最小高度
    show: false,
    frame: false, // 去除原生标题栏
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // 开发模式下打开 DevTools
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  let isQuitting = false

  // 创建系统托盘
  const tray = new Tray(trayIcon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示',
      click: () => {
        mainWindow.show()
      }
    },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('极简待办')
  tray.setContextMenu(contextMenu)

  // 托盘图标点击事件 - 显示并聚焦窗口
  tray.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  // 窗口关闭时隐藏而不是退出
  mainWindow.on('close', (event) => {
    // Save window bounds before hiding or closing
    if (!mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds()
      store.set('windowBounds', bounds)
    }

    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
    return false
  })

  // 窗口控制 IPC 处理器
  ipcMain.on('window:minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.on('window:close', () => {
    // Save bounds when manual close triggered from UI
    if (!mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds()
      store.set('windowBounds', bounds)
    }
    mainWindow.hide() // 改为隐藏窗口而不是关闭
  })

  ipcMain.on('window:toggle-always-on-top', () => {
    const flag = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(flag)
    mainWindow.webContents.send('window:always-on-top-changed', flag)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 初始化数据库
  db.initDatabase()

  // 注册数据库 IPC 处理器
  // Category 相关
  ipcMain.handle('db:get-categories', async () => db.getAllCategories())
  ipcMain.handle('db:create-category', async (_, name: string) => db.createCategory(name))
  ipcMain.handle('db:update-category', async (_, id: number, name: string) =>
    db.updateCategory(id, name)
  )
  ipcMain.handle('db:delete-category', async (_, id: number) => db.deleteCategory(id))

  // Task 相关
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

  // SubTask 相关
  ipcMain.handle('db:get-subtasks', async (_, parentId: number) => db.getSubTasks(parentId))
  ipcMain.handle('db:create-subtask', async (_, content: string, parentId: number) =>
    db.createSubTask(content, parentId)
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.closeDatabase()
    app.quit()
  }
})

// 在 macOS 上退出前关闭数据库
app.on('before-quit', () => {
  db.closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
