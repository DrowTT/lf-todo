import { app, shell, BrowserWindow, ipcMain, Tray, Menu, dialog } from 'electron'
import { appendFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import * as db from './db/database'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater } from './updater'
import { parseBooleanSetting, parseSetAutoCleanupRequest } from '../shared/contracts/settings'

interface AutoCleanupConfig {
  enabled: boolean
  days: number
}

interface StoreType {
  windowBounds: {
    width: number
    height: number
    x: number
    y: number
  }
  alwaysOnTop: boolean
  autoLaunch: boolean
  closeToTray: boolean
  autoCleanup: AutoCleanupConfig
}

const store = new Store<StoreType>()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let settingsHandlersRegistered = false

function isHiddenLaunch(): boolean {
  return process.argv.includes('--hidden')
}

function getAutoLaunchState(): boolean {
  const loginItemSettings = app.getLoginItemSettings()

  if (process.platform === 'win32') {
    return loginItemSettings.openAtLogin || loginItemSettings.executableWillLaunchAtLogin
  }

  return loginItemSettings.openAtLogin
}

function setAutoLaunchEnabled(enabled: boolean): boolean {
  const loginItemSettings =
    process.platform === 'win32'
      ? {
          openAtLogin: enabled,
          path: process.execPath,
          args: enabled ? ['--hidden'] : [],
          enabled
        }
      : {
          openAtLogin: enabled,
          openAsHidden: enabled
        }

  app.setLoginItemSettings(loginItemSettings)

  const actualEnabled = getAutoLaunchState()

  if (actualEnabled !== enabled) {
    writeStartupLog('settings', 'auto launch state mismatch after update', {
      requested: enabled,
      actual: actualEnabled,
      execPath: process.execPath,
      argv: process.argv,
      loginItemSettings: app.getLoginItemSettings(),
      platform: process.platform
    })
  }

  store.set('autoLaunch', actualEnabled)
  return actualEnabled
}

function writeStartupLog(scope: string, message: string, detail?: unknown): void {
  try {
    const logPath = join(app.getPath('userData'), 'startup.log')
    const payload =
      detail instanceof Error
        ? `${detail.name}: ${detail.message}\n${detail.stack ?? ''}`
        : detail === undefined
          ? ''
          : typeof detail === 'string'
            ? detail
            : JSON.stringify(detail, null, 2)

    appendFileSync(
      logPath,
      `[${new Date().toISOString()}] [${scope}] ${message}${payload ? `\n${payload}` : ''}\n`,
      'utf8'
    )
  } catch (error) {
    console.error('[startup-log] write failed:', error)
  }
}

function resolveRuntimeAsset(fileName: string): string {
  return is.dev
    ? join(app.getAppPath(), 'resources', fileName)
    : join(process.resourcesPath, fileName)
}

function registerSettingsHandlers(): void {
  if (settingsHandlersRegistered) return
  settingsHandlersRegistered = true

  ipcMain.handle('settings:get-all', () => {
    const autoLaunch = getAutoLaunchState()
    store.set('autoLaunch', autoLaunch)

    return {
      autoLaunch,
      closeToTray: store.get('closeToTray', true),
      autoCleanup: store.get('autoCleanup', { enabled: false, days: 7 })
    }
  })

  ipcMain.handle('settings:set-auto-launch', (_, enabled: boolean) => {
    const nextEnabled = parseBooleanSetting(enabled, 'settings:set-auto-launch.request')
    return setAutoLaunchEnabled(nextEnabled)
  })

  ipcMain.handle('settings:set-close-to-tray', (_, enabled: boolean) => {
    const nextEnabled = parseBooleanSetting(enabled, 'settings:set-close-to-tray.request')
    store.set('closeToTray', nextEnabled)
    return nextEnabled
  })

  ipcMain.handle('settings:set-auto-cleanup', (_, config: AutoCleanupConfig) => {
    const nextConfig = parseSetAutoCleanupRequest(config, 'settings:set-auto-cleanup.request')
    store.set('autoCleanup', nextConfig)
    return nextConfig
  })

  ipcMain.handle('settings:export-data', async () => {
    const win = mainWindow
    if (!win) return false

    const result = await dialog.showSaveDialog(win, {
      title: '导出待办数据',
      defaultPath: `极简待办-数据导出-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) return false

    const data = db.exportAllData()
    writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  })

  ipcMain.handle('settings:get-app-info', () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    }
  })
}

function attachWindowDiagnostics(win: BrowserWindow): void {
  win.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      writeStartupLog('main', 'renderer did-fail-load', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      })
    }
  )

  win.webContents.on('render-process-gone', (_event, details) => {
    writeStartupLog('main', 'renderer render-process-gone', details)
  })

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    writeStartupLog('main', 'renderer preload-error', {
      preloadPath,
      error: error.message,
      stack: error.stack
    })
  })
}

function createTray(win: BrowserWindow, setQuitting: () => void): void {
  try {
    tray = new Tray(resolveRuntimeAsset('tray-icon.png'))

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示',
        click: () => {
          win.show()
          win.focus()
        }
      },
      {
        label: '退出',
        click: () => {
          setQuitting()
          app.quit()
        }
      }
    ])

    tray.setToolTip('极简待办')
    tray.setContextMenu(contextMenu)
    tray.on('click', () => {
      win.show()
      win.focus()
    })
  } catch (error) {
    tray = null
    writeStartupLog('main', 'tray initialization failed', error)
  }
}

function createWindow(): void {
  const bounds = store.get('windowBounds')
  const launchedHidden = isHiddenLaunch()

  const win = new BrowserWindow({
    width: bounds?.width || 900,
    height: bounds?.height || 670,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 400,
    minHeight: 500,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    icon: resolveRuntimeAsset('icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow = win
  attachWindowDiagnostics(win)

  win.on('ready-to-show', () => {
    const savedOnTop = store.get('alwaysOnTop', false)
    if (savedOnTop) {
      win.setAlwaysOnTop(true)
      win.webContents.send('window:always-on-top-changed', true)
    }

    if (!launchedHidden) {
      win.show()
    }

    // 初始化自动更新模块
    initAutoUpdater(win)

    if (is.dev) {
      win.webContents.openDevTools()
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  let isQuitting = false
  createTray(win, () => {
    isQuitting = true
  })

  win.on('close', (event) => {
    if (!win.isDestroyed()) {
      store.set('windowBounds', win.getBounds())
    }

    const closeToTray = store.get('closeToTray', true)
    if (!isQuitting && closeToTray && tray) {
      event.preventDefault()
      win.hide()
    }
  })

  ipcMain.on('window:minimize', () => {
    win.minimize()
  })

  ipcMain.on('window:close', () => {
    if (!win.isDestroyed()) {
      store.set('windowBounds', win.getBounds())
    }

    const closeToTray = store.get('closeToTray', true)
    if (closeToTray && tray) {
      win.hide()
      return
    }

    isQuitting = true
    app.quit()
  })

  ipcMain.on('window:toggle-always-on-top', () => {
    const flag = !win.isAlwaysOnTop()
    win.setAlwaysOnTop(flag)
    store.set('alwaysOnTop', flag)
    win.webContents.send('window:always-on-top-changed', flag)
  })

  ipcMain.on('window:toggle-maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  win.on('maximize', () => {
    win.webContents.send('window:maximized-changed', true)
  })

  win.on('unmaximize', () => {
    win.webContents.send('window:maximized-changed', false)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (!mainWindow) return

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  db.initDatabase()

  const persistedAutoLaunch = store.get('autoLaunch')
  const actualAutoLaunch = getAutoLaunchState()
  if (typeof persistedAutoLaunch === 'boolean' && persistedAutoLaunch !== actualAutoLaunch) {
    setAutoLaunchEnabled(persistedAutoLaunch)
  } else if (persistedAutoLaunch !== actualAutoLaunch) {
    store.set('autoLaunch', actualAutoLaunch)
  }

  const cleanupConfig = store.get('autoCleanup', { enabled: false, days: 7 })
  if (cleanupConfig.enabled && cleanupConfig.days > 0) {
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - cleanupConfig.days * 86400
    db.deleteCompletedTasksBefore(cutoffTimestamp)
  }

  registerIpcHandlers()
  registerSettingsHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  db.closeDatabase()
})

app.on('render-process-gone', (_event, _webContents, details) => {
  writeStartupLog('app', 'app render-process-gone', details)
})

process.on('uncaughtException', (error) => {
  writeStartupLog('process', 'uncaughtException', error)
})

process.on('unhandledRejection', (reason) => {
  writeStartupLog('process', 'unhandledRejection', reason)
})
