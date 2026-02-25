import { app, shell, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import trayIcon from '../../resources/tray-icon.png?asset'
import * as db from './db/database'
import Store from 'electron-store'
import { registerIpcHandlers } from './ipc'

interface StoreType {
  windowBounds: {
    width: number
    height: number
    x: number
    y: number
  }
}

const store = new Store<StoreType>()

// 单实例锁：防止重复启动
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  // 已有实例在运行，直接退出当前进程
  app.quit()
}

// 模块级引用，供 second-instance 事件使用
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Restore window bounds
  const bounds = store.get('windowBounds')

  // 用局部 const win 创建窗口，避免 TS 对模块级 null 的误判
  const win = new BrowserWindow({
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

  // 赋值给模块级变量，供 second-instance 事件使用
  mainWindow = win

  win.on('ready-to-show', () => {
    win.show()
    // 开发模式下打开 DevTools
    if (is.dev) {
      win.webContents.openDevTools()
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
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
        win.show()
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
    win.show()
    win.focus()
  })

  // 窗口关闭时隐藏而不是退出
  win.on('close', (event) => {
    // Save window bounds before hiding or closing
    if (!win.isDestroyed()) {
      const bounds = win.getBounds()
      store.set('windowBounds', bounds)
    }

    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
    return false
  })

  // 窗口控制 IPC 处理器
  ipcMain.on('window:minimize', () => {
    win.minimize()
  })

  ipcMain.on('window:close', () => {
    // Save bounds when manual close triggered from UI
    if (!win.isDestroyed()) {
      const bounds = win.getBounds()
      store.set('windowBounds', bounds)
    }
    win.hide() // 改为隐藏窗口而不是关闭
  })

  ipcMain.on('window:toggle-always-on-top', () => {
    const flag = !win.isAlwaysOnTop()
    win.setAlwaysOnTop(flag)
    win.webContents.send('window:always-on-top-changed', flag)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// 当第二个实例尝试启动时，将已有窗口显示并聚焦
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

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

  // 注册所有数据库 IPC 处理器
  registerIpcHandlers()

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
