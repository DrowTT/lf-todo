import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  dialog,
  screen,
  globalShortcut,
  Notification
} from 'electron'
import type { Display, Rectangle } from 'electron'
import { appendFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import * as db from './db/database'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater } from './updater'
import {
  parseBooleanSetting,
  parseNotifyPomodoroCompletedRequest,
  parseSetAutoCleanupRequest,
  parseSetPomodoroFocusDurationRequest
} from '../shared/contracts/settings'
import {
  createPomodoroCompletionMessage,
  DEFAULT_FOCUS_DURATION_SECONDS,
  normalizePomodoroDurationSeconds
} from '../shared/constants/pomodoro'

interface AutoCleanupConfig {
  enabled: boolean
  days: number
}

interface PomodoroTaskBinding {
  taskId: number | null
  taskContentSnapshot: string | null
}

interface PomodoroSessionState extends PomodoroTaskBinding {
  startedAt: number
  endsAt: number
  durationSeconds: number
  source: 'global' | 'task'
}

interface PomodoroRecord extends PomodoroTaskBinding {
  id: string
  completedAt: number
  durationSeconds: number
  source: 'global' | 'task'
}

interface PomodoroData {
  focusDurationSeconds: number
  totalCompletedCount: number
  activeSession: PomodoroSessionState | null
  history: PomodoroRecord[]
}

interface HotkeyBinding {
  key: string
  label: string
}

type GlobalHotkeyAction = 'showWindow' | 'showWindowAndFocusInput'
type GlobalHotkeyConfig = Record<GlobalHotkeyAction, HotkeyBinding>

interface StoreType {
  windowBounds: {
    width: number
    height: number
    x: number
    y: number
    displayId?: number
  }
  alwaysOnTop: boolean
  autoLaunch: boolean
  closeToTray: boolean
  autoCleanup: AutoCleanupConfig
  pomodoro: PomodoroData
  globalHotkeys: GlobalHotkeyConfig
}

const store = new Store<StoreType>()
const DEFAULT_WINDOW_SIZE = { width: 900, height: 670 }
const MIN_WINDOW_SIZE = { width: 400, height: 500 }
const DEFAULT_GLOBAL_HOTKEYS: GlobalHotkeyConfig = {
  showWindow: { key: 'Control+Alt+L', label: 'Ctrl+Alt+L' },
  showWindowAndFocusInput: { key: 'Control+Alt+N', label: 'Ctrl+Alt+N' }
}
const DEFAULT_POMODORO_DATA: PomodoroData = {
  focusDurationSeconds: DEFAULT_FOCUS_DURATION_SECONDS,
  totalCompletedCount: 0,
  activeSession: null,
  history: []
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let settingsHandlersRegistered = false
let releaseTopMostTimer: NodeJS.Timeout | null = null

function getStoredPomodoroData(): PomodoroData {
  const raw = store.get('pomodoro', DEFAULT_POMODORO_DATA) as Partial<PomodoroData> | undefined

  return {
    focusDurationSeconds: normalizePomodoroDurationSeconds(raw?.focusDurationSeconds),
    totalCompletedCount:
      typeof raw?.totalCompletedCount === 'number' && raw.totalCompletedCount >= 0
        ? raw.totalCompletedCount
        : DEFAULT_POMODORO_DATA.totalCompletedCount,
    activeSession: raw?.activeSession ?? DEFAULT_POMODORO_DATA.activeSession,
    history: Array.isArray(raw?.history) ? raw.history : DEFAULT_POMODORO_DATA.history
  }
}

function isHotkeyBinding(value: unknown): value is HotkeyBinding {
  if (!value || typeof value !== 'object') return false

  const binding = value as Partial<HotkeyBinding>
  return typeof binding.key === 'string' && typeof binding.label === 'string'
}

function hasAtLeastTwoKeys(binding: HotkeyBinding): boolean {
  return (
    binding.key
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean).length >= 2
  )
}

function sanitizeGlobalHotkeys(raw: unknown): GlobalHotkeyConfig {
  const input = raw && typeof raw === 'object' ? (raw as Partial<GlobalHotkeyConfig>) : {}
  const nextConfig = {} as GlobalHotkeyConfig

  for (const action of Object.keys(DEFAULT_GLOBAL_HOTKEYS) as GlobalHotkeyAction[]) {
    const candidate = input[action]
    nextConfig[action] =
      isHotkeyBinding(candidate) && hasAtLeastTwoKeys(candidate)
        ? candidate
        : { ...DEFAULT_GLOBAL_HOTKEYS[action] }
  }

  return nextConfig
}

function toElectronAccelerator(key: string): string {
  return key
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part === 'Control') return 'CommandOrControl'
      if (part.length === 1) return part.toUpperCase()
      return part
    })
    .join('+')
}

function bringWindowToFront(win: BrowserWindow, options?: { focusMainInput?: boolean }): void {
  if (win.isDestroyed()) return

  if (releaseTopMostTimer) {
    clearTimeout(releaseTopMostTimer)
    releaseTopMostTimer = null
  }

  if (win.isMinimized()) {
    win.restore()
  }

  const persistedAlwaysOnTop = store.get('alwaysOnTop', false)
  const shouldUseTemporaryTopMost = !persistedAlwaysOnTop && !win.isAlwaysOnTop()

  if (shouldUseTemporaryTopMost) {
    win.setAlwaysOnTop(true)
  }

  win.show()
  win.focus()
  win.moveTop()

  if (options?.focusMainInput) {
    win.webContents.send('window:focus-main-input')
  }

  if (shouldUseTemporaryTopMost) {
    releaseTopMostTimer = setTimeout(() => {
      if (!win.isDestroyed() && !store.get('alwaysOnTop', false)) {
        win.setAlwaysOnTop(false)
      }
      releaseTopMostTimer = null
    }, 500)
  }
}

function registerGlobalHotkeys(): void {
  globalShortcut.unregisterAll()

  const config = sanitizeGlobalHotkeys(store.get('globalHotkeys'))
  store.set('globalHotkeys', config)

  for (const action of Object.keys(config) as GlobalHotkeyAction[]) {
    const accelerator = toElectronAccelerator(config[action].key)
    const success = globalShortcut.register(accelerator, () => {
      if (!mainWindow) return

      bringWindowToFront(mainWindow, {
        focusMainInput: action === 'showWindowAndFocusInput'
      })
    })

    if (!success) {
      writeStartupLog('main', 'global shortcut registration failed', {
        action,
        accelerator
      })
    }
  }
}

function getScaledMinWindowSize(display: Display): Pick<Rectangle, 'width' | 'height'> {
  const scaleFactor = display.scaleFactor > 0 ? display.scaleFactor : 1

  return {
    width: Math.max(1, Math.round(MIN_WINDOW_SIZE.width / scaleFactor)),
    height: Math.max(1, Math.round(MIN_WINDOW_SIZE.height / scaleFactor))
  }
}

function clampWindowSizeForDisplay(
  size: Pick<Rectangle, 'width' | 'height'>,
  display: Display
): Pick<Rectangle, 'width' | 'height'> {
  const minWindowSize = getScaledMinWindowSize(display)

  return {
    width: Math.max(minWindowSize.width, Math.min(Math.round(size.width), display.workArea.width)),
    height: Math.max(
      minWindowSize.height,
      Math.min(Math.round(size.height), display.workArea.height)
    )
  }
}

function clampWindowPosition(
  bounds: Pick<Rectangle, 'x' | 'y' | 'width' | 'height'>,
  workArea: Rectangle
): Pick<Rectangle, 'x' | 'y'> {
  const maxX = workArea.x + Math.max(0, workArea.width - bounds.width)
  const maxY = workArea.y + Math.max(0, workArea.height - bounds.height)

  return {
    x: Math.min(Math.max(Math.round(bounds.x), workArea.x), maxX),
    y: Math.min(Math.max(Math.round(bounds.y), workArea.y), maxY)
  }
}

function centerWindowPosition(
  size: Pick<Rectangle, 'width' | 'height'>,
  workArea: Rectangle
): Pick<Rectangle, 'x' | 'y'> {
  return {
    x: Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: Math.round(workArea.y + (workArea.height - size.height) / 2)
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function resolveDisplayForSavedBounds(savedBounds: StoreType['windowBounds']): {
  display: Display
  isSameDisplay: boolean
} {
  if (isFiniteNumber(savedBounds.displayId)) {
    const matchedDisplay = screen
      .getAllDisplays()
      .find((display) => display.id === savedBounds.displayId)
    if (matchedDisplay) {
      return { display: matchedDisplay, isSameDisplay: true }
    }
  }

  if (isFiniteNumber(savedBounds.x) && isFiniteNumber(savedBounds.y)) {
    return {
      display: screen.getDisplayNearestPoint({
        x: Math.round(savedBounds.x),
        y: Math.round(savedBounds.y)
      }),
      isSameDisplay: false
    }
  }

  return { display: screen.getPrimaryDisplay(), isSameDisplay: false }
}

function resolveInitialWindowBounds(): Rectangle {
  const savedBounds = store.get('windowBounds')
  if (
    !savedBounds ||
    !isFiniteNumber(savedBounds.width) ||
    !isFiniteNumber(savedBounds.height) ||
    !isFiniteNumber(savedBounds.x) ||
    !isFiniteNumber(savedBounds.y)
  ) {
    return {
      ...DEFAULT_WINDOW_SIZE,
      ...centerWindowPosition(DEFAULT_WINDOW_SIZE, screen.getPrimaryDisplay().workArea)
    }
  }

  const { display, isSameDisplay } = resolveDisplayForSavedBounds(savedBounds)
  const restoredDipBounds = savedBounds
  const scaledSize = clampWindowSizeForDisplay(
    {
      width: restoredDipBounds.width,
      height: restoredDipBounds.height
    },
    display
  )
  const position = isSameDisplay
    ? clampWindowPosition(
        {
          x: restoredDipBounds.x,
          y: restoredDipBounds.y,
          ...scaledSize
        },
        display.workArea
      )
    : centerWindowPosition(scaledSize, display.workArea)

  return {
    ...scaledSize,
    ...position
  }
}

function persistWindowBounds(win: BrowserWindow): void {
  if (win.isDestroyed()) return

  const bounds = win.getNormalBounds()
  const display = screen.getDisplayMatching(bounds)
  const widthScaleFactor = display.scaleFactor > 0 ? display.scaleFactor : 1
  const persistedBounds = {
    x: bounds.x,
    y: bounds.y,
    width: Math.round(bounds.width / widthScaleFactor),
    height: Math.round(bounds.height / widthScaleFactor),
    displayId: display.id
  }

  store.set('windowBounds', persistedBounds)
}

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

    const pomodoro = getStoredPomodoroData()

    return {
      autoLaunch,
      closeToTray: store.get('closeToTray', true),
      autoCleanup: store.get('autoCleanup', { enabled: false, days: 7 }),
      // focusDurationSeconds 由持久化值恢复，用户可在设置中修改
      pomodoro
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

  ipcMain.handle('settings:set-pomodoro-focus-duration', (_event, durationSecondsRaw: unknown) => {
    const durationSeconds = parseSetPomodoroFocusDurationRequest(
      durationSecondsRaw,
      'settings:set-pomodoro-focus-duration.request'
    )
    const current = getStoredPomodoroData()
    const nextPomodoro: PomodoroData = { ...current, focusDurationSeconds: durationSeconds }
    store.set('pomodoro', nextPomodoro)
    return durationSeconds
  })

  ipcMain.handle(
    'settings:set-pomodoro-active-session',
    (_event, session: PomodoroSessionState | null) => {
      const current = getStoredPomodoroData()
      const nextPomodoro = { ...current, activeSession: session }
      store.set('pomodoro', nextPomodoro)
      return nextPomodoro.activeSession
    }
  )

  ipcMain.handle('settings:complete-pomodoro-session', (_event, session: PomodoroSessionState) => {
    const current = getStoredPomodoroData()
    const completedAt = Date.now()
    const nextRecord: PomodoroRecord = {
      id: `${completedAt}-${Math.random().toString(36).slice(2, 10)}`,
      completedAt,
      durationSeconds: session.durationSeconds,
      source: session.source,
      taskId: session.taskId,
      taskContentSnapshot: session.taskContentSnapshot
    }

    const nextPomodoro: PomodoroData = {
      ...current,
      totalCompletedCount: current.totalCompletedCount + 1,
      activeSession: null,
      history: [...current.history, nextRecord]
    }

    store.set('pomodoro', nextPomodoro)
    return nextPomodoro
  })

  ipcMain.handle('settings:set-global-hotkeys', (_event, config: unknown) => {
    const nextConfig = sanitizeGlobalHotkeys(config)
    store.set('globalHotkeys', nextConfig)
    registerGlobalHotkeys()
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

  ipcMain.handle('settings:notify-pomodoro-completed', (_event, durationSecondsRaw: unknown) => {
    if (!Notification.isSupported()) return

    const durationSeconds = parseNotifyPomodoroCompletedRequest(
      durationSecondsRaw,
      'settings:notify-pomodoro-completed.request'
    )

    new Notification({
      title: '番茄钟完成',
      body: createPomodoroCompletionMessage(durationSeconds),
      silent: false
    }).show()
  })
}

async function confirmQuitWithRunningPomodoro(win: BrowserWindow): Promise<boolean> {
  const pomodoro = getStoredPomodoroData()
  if (!pomodoro.activeSession) return true

  bringWindowToFront(win)

  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['继续退出', '取消'],
    defaultId: 1,
    cancelId: 1,
    title: '番茄钟进行中',
    message: '退出将终止当前番茄钟，且不会记录本次专注。',
    detail: '确认继续退出吗？'
  })

  if (result.response !== 0) {
    return false
  }

  store.set('pomodoro', { ...pomodoro, activeSession: null })
  return true
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
          bringWindowToFront(win)
        }
      },
      {
        label: '退出',
        click: async () => {
          const canQuit = await confirmQuitWithRunningPomodoro(win)
          if (!canQuit) return

          setQuitting()
          app.quit()
        }
      }
    ])

    tray.setToolTip('极简待办')
    tray.setContextMenu(contextMenu)
    tray.on('click', () => {
      bringWindowToFront(win)
    })
  } catch (error) {
    tray = null
    writeStartupLog('main', 'tray initialization failed', error)
  }
}

function createWindow(): void {
  const bounds = resolveInitialWindowBounds()
  const launchedHidden = isHiddenLaunch()
  const targetDisplay = screen.getDisplayMatching(bounds)
  const minWindowSize = getScaledMinWindowSize(targetDisplay)

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: minWindowSize.width,
    minHeight: minWindowSize.height,
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
      win.webContents.openDevTools({ mode: 'detach' })
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
    persistWindowBounds(win)

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
    persistWindowBounds(win)

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

  bringWindowToFront(mainWindow)
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
  registerGlobalHotkeys()

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
  globalShortcut.unregisterAll()
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
