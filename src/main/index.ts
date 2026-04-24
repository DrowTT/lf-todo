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
import { appendFileSync } from 'fs'
import { readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import * as db from './db/database'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater } from './updater'
import {
  BackupCompatibilityError,
  buildBackupEnvelope,
  parseBackupImportPayload
} from '../shared/contracts/backup'
import {
  parseBooleanSetting,
  parseNotifyPomodoroCompletedRequest,
  parseSetAutoCleanupRequest,
  parseSetPomodoroFocusDurationRequest
} from '../shared/contracts/settings'
import { expectInteger } from '../shared/contracts/utils'
import {
  createPomodoroCompletionMessage,
  DEFAULT_FOCUS_DURATION_SECONDS,
  normalizePomodoroDurationSeconds
} from '../shared/constants/pomodoro'
import { MIN_MAIN_WINDOW_WIDTH } from '../shared/constants/layout'
import type {
  BackupDataPayload,
  BackupImportErrorCode,
  BackupImportResult,
  BackupImportSummary
} from '../shared/types/backup'
import type { QuickAddCommittedEvent } from '../shared/types/models'
import { ContractError } from '../shared/contracts/utils'

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

interface DueReminderState {
  notifiedTaskKeys: string[]
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
  dueReminder: DueReminderState
  globalHotkeys: GlobalHotkeyConfig
}

const store = new Store<StoreType>()
const DEFAULT_WINDOW_SIZE = { width: 900, height: 670 }
const MIN_WINDOW_SIZE = { width: MIN_MAIN_WINDOW_WIDTH, height: 500 }
const QUICK_ADD_WINDOW_SIZE = { width: 460, height: 168 }
const QUICK_ADD_WINDOW_HEIGHT_RANGE = { min: 140, max: 420 }
const QUICK_ADD_WINDOW_EDGE_MARGIN = 18
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
const DEFAULT_DUE_REMINDER_STATE: DueReminderState = {
  notifiedTaskKeys: []
}
const APP_USER_MODEL_ID = 'com.lf.todo'
const AUTO_LAUNCH_HIDDEN_ARG = '--hidden'
const DUE_REMINDER_CHECK_INTERVAL_MS = 30 * 1000
const MAX_BACKUP_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024
const SECOND = 1000

let mainWindow: BrowserWindow | null = null
let quickAddWindow: BrowserWindow | null = null
let tray: Tray | null = null
let settingsHandlersRegistered = false
let windowIpcHandlersRegistered = false
let mainWindowIpcHandlersRegistered = false
let releaseTopMostTimer: NodeJS.Timeout | null = null
let dueReminderTimer: NodeJS.Timeout | null = null
let quickAddWindowReady = false
let shouldShowQuickAddWhenReady = false
let isAppQuitting = false

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

function getStoredDueReminderState(): DueReminderState {
  const raw = store.get('dueReminder', DEFAULT_DUE_REMINDER_STATE) as
    | Partial<DueReminderState>
    | undefined

  return {
    notifiedTaskKeys: Array.isArray(raw?.notifiedTaskKeys)
      ? raw.notifiedTaskKeys.filter((value): value is string => typeof value === 'string')
      : []
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

function bringWindowToFront(
  win: BrowserWindow,
  options?: { focusEventChannel?: 'window:focus-main-input' | 'window:focus-quick-add-input' }
): void {
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

  if (options?.focusEventChannel) {
    win.webContents.send(options.focusEventChannel)
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

function hideQuickAddWindow(): void {
  if (!quickAddWindow || quickAddWindow.isDestroyed()) {
    quickAddWindow = null
    quickAddWindowReady = false
    shouldShowQuickAddWhenReady = false
    return
  }

  shouldShowQuickAddWhenReady = false

  if (quickAddWindow.isVisible()) {
    quickAddWindow.hide()
  }
}

function loadRendererEntry(win: BrowserWindow, mode: 'main' | 'quick-add'): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])

    if (mode !== 'main') {
      url.searchParams.set('mode', mode)
    }

    win.loadURL(url.toString())
    return
  }

  const rendererIndexPath = join(__dirname, '../renderer/index.html')

  if (mode === 'main') {
    win.loadFile(rendererIndexPath)
    return
  }

  win.loadFile(rendererIndexPath, {
    query: { mode }
  })
}

function resolveQuickAddWindowBounds(): Rectangle {
  const referenceWindow =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getFocusedWindow()
  const display = referenceWindow
    ? screen.getDisplayMatching(referenceWindow.getBounds())
    : screen.getPrimaryDisplay()
  const size = {
    width: Math.min(QUICK_ADD_WINDOW_SIZE.width, display.workArea.width),
    height: Math.min(QUICK_ADD_WINDOW_SIZE.height, display.workArea.height)
  }

  return {
    ...size,
    ...clampWindowPosition(
      {
        width: size.width,
        height: size.height,
        x: display.workArea.x + display.workArea.width - size.width - QUICK_ADD_WINDOW_EDGE_MARGIN,
        y: display.workArea.y + display.workArea.height - size.height - QUICK_ADD_WINDOW_EDGE_MARGIN
      },
      display.workArea
    )
  }
}

function createQuickAddWindow(): BrowserWindow {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    return quickAddWindow
  }

  const bounds = resolveQuickAddWindowBounds()
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    icon: resolveRuntimeAsset('icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  quickAddWindow = win
  quickAddWindowReady = false
  shouldShowQuickAddWhenReady = false
  attachWindowDiagnostics(win)

  win.on('close', (event) => {
    if (isAppQuitting) {
      return
    }

    event.preventDefault()
    hideQuickAddWindow()
  })

  win.on('ready-to-show', () => {
    quickAddWindowReady = true

    if (!shouldShowQuickAddWhenReady) {
      return
    }

    showQuickAddWindow()
  })

  win.on('closed', () => {
    if (quickAddWindow === win) {
      quickAddWindow = null
      quickAddWindowReady = false
      shouldShowQuickAddWhenReady = false
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRendererEntry(win, 'quick-add')
  return win
}

function showQuickAddWindow(): void {
  if (!quickAddWindow || quickAddWindow.isDestroyed()) {
    createQuickAddWindow()
  }

  if (!quickAddWindow || quickAddWindow.isDestroyed()) {
    quickAddWindow = null
    quickAddWindowReady = false
    shouldShowQuickAddWhenReady = false
    return
  }

  if (quickAddWindow.isVisible()) {
    bringWindowToFront(quickAddWindow, {
      focusEventChannel: 'window:focus-quick-add-input'
    })
    return
  }

  quickAddWindow.setBounds(resolveQuickAddWindowBounds(), false)

  if (!quickAddWindowReady) {
    shouldShowQuickAddWhenReady = true
    return
  }

  shouldShowQuickAddWhenReady = false
  bringWindowToFront(quickAddWindow, {
    focusEventChannel: 'window:focus-quick-add-input'
  })
  quickAddWindow.webContents.send('window:quick-add-session-requested')
}

function getActiveMainWindow(): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = null
    return null
  }

  return mainWindow
}

function ensureMainWindow(): BrowserWindow | null {
  const win = getActiveMainWindow()
  if (win) {
    return win
  }

  if (!app.isReady()) {
    return null
  }

  return createWindow()
}

function showMainWindow(options?: {
  focusEventChannel?: 'window:focus-main-input' | 'window:focus-quick-add-input'
}): void {
  const win = ensureMainWindow()
  if (!win) return

  hideQuickAddWindow()
  bringWindowToFront(win, options)
}

function notifyQuickAddCommitted(payload: QuickAddCommittedEvent): void {
  const win = getActiveMainWindow()
  if (!win) return

  win.webContents.send('window:quick-add-committed', payload)
}

function registerGlobalHotkeys(): void {
  globalShortcut.unregisterAll()

  const config = sanitizeGlobalHotkeys(store.get('globalHotkeys'))
  store.set('globalHotkeys', config)

  for (const action of Object.keys(config) as GlobalHotkeyAction[]) {
    const accelerator = toElectronAccelerator(config[action].key)
    const success = globalShortcut.register(accelerator, () => {
      if (action === 'showWindow') {
        showMainWindow()
        return
      }

      const win = ensureMainWindow()
      if (!win) return

      const mainWindowVisible = win.isVisible() && !win.isMinimized()

      if (mainWindowVisible) {
        showMainWindow({
          focusEventChannel: 'window:focus-main-input'
        })
        return
      }

      showQuickAddWindow()
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
  return process.argv.includes(AUTO_LAUNCH_HIDDEN_ARG)
}

function canManageAutoLaunch(): boolean {
  return !(process.platform === 'win32' && process.defaultApp)
}

function getWindowsAutoLaunchQuery() {
  return {
    path: process.execPath,
    args: [AUTO_LAUNCH_HIDDEN_ARG]
  }
}

function getAutoLaunchState(): boolean {
  if (!canManageAutoLaunch()) {
    return false
  }

  const loginItemSettings =
    process.platform === 'win32'
      ? app.getLoginItemSettings(getWindowsAutoLaunchQuery())
      : app.getLoginItemSettings()

  if (process.platform === 'win32') {
    return loginItemSettings.openAtLogin || loginItemSettings.executableWillLaunchAtLogin
  }

  return loginItemSettings.openAtLogin
}

function setAutoLaunchEnabled(enabled: boolean): boolean {
  if (!canManageAutoLaunch()) {
    writeStartupLog('settings', 'auto launch is unavailable in the current runtime', {
      requested: enabled,
      execPath: process.execPath,
      defaultApp: process.defaultApp,
      platform: process.platform
    })
    store.set('autoLaunch', false)
    return false
  }

  const loginItemSettings =
    process.platform === 'win32'
      ? {
          openAtLogin: enabled,
          enabled,
          name: APP_USER_MODEL_ID,
          ...getWindowsAutoLaunchQuery()
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
      requestedSettings: loginItemSettings,
      loginItemSettings:
        process.platform === 'win32'
          ? app.getLoginItemSettings(getWindowsAutoLaunchQuery())
          : app.getLoginItemSettings(),
      rawLoginItemSettings: app.getLoginItemSettings(),
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

function createDueReminderTaskKey(task: db.DueReminderTask): string {
  return `${task.id}:${task.due_at}:${task.due_precision}`
}

function getDueReminderBoundaryMs(
  task: Pick<db.DueReminderTask, 'due_at' | 'due_precision'>
): number {
  const dueDate = new Date(task.due_at * SECOND)

  if (task.due_precision === 'datetime') {
    return dueDate.getTime()
  }

  dueDate.setHours(23, 59, 59, 999)
  return dueDate.getTime()
}

function isTaskOverdueForReminder(
  task: Pick<db.DueReminderTask, 'due_at' | 'due_precision'>,
  nowMs = Date.now()
): boolean {
  return nowMs > getDueReminderBoundaryMs(task)
}

function formatDueReminderMoment(task: db.DueReminderTask): string {
  const dueDate = new Date(task.due_at * SECOND)
  const dateLabel = `${dueDate.getMonth() + 1}月${dueDate.getDate()}日`

  if (task.due_precision === 'datetime') {
    return `${dateLabel} ${dueDate.getHours().toString().padStart(2, '0')}:${dueDate
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
  }

  return `${dateLabel} 截止`
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function showDueReminderNotification(task: db.DueReminderTask): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({
    title: '待办已逾期',
    body: `「${truncateText(task.content, 28)}」\n${task.category_name} · ${formatDueReminderMoment(task)}`,
    silent: false
  })

  notification.on('click', () => {
    if (!mainWindow) return
    bringWindowToFront(mainWindow)
  })

  notification.show()
}

function syncDueReminderNotifications(): void {
  if (!Notification.isSupported()) return

  const candidates = db.getDueReminderTasks()
  const nowMs = Date.now()
  const previousState = getStoredDueReminderState()
  const notifiedTaskKeys = new Set(previousState.notifiedTaskKeys)
  const activeOverdueTaskKeys = new Set<string>()

  for (const task of candidates) {
    if (!isTaskOverdueForReminder(task, nowMs)) {
      continue
    }

    const taskKey = createDueReminderTaskKey(task)
    activeOverdueTaskKeys.add(taskKey)

    if (notifiedTaskKeys.has(taskKey)) {
      continue
    }

    showDueReminderNotification(task)
    notifiedTaskKeys.add(taskKey)
  }

  const nextNotifiedTaskKeys = [...notifiedTaskKeys].filter((taskKey) =>
    activeOverdueTaskKeys.has(taskKey)
  )

  if (
    nextNotifiedTaskKeys.length !== previousState.notifiedTaskKeys.length ||
    nextNotifiedTaskKeys.some((taskKey, index) => taskKey !== previousState.notifiedTaskKeys[index])
  ) {
    store.set('dueReminder', {
      notifiedTaskKeys: nextNotifiedTaskKeys
    })
  }
}

function startDueReminderScheduler(): void {
  stopDueReminderScheduler()
  syncDueReminderNotifications()
  dueReminderTimer = setInterval(() => {
    syncDueReminderNotifications()
  }, DUE_REMINDER_CHECK_INTERVAL_MS)
}

function stopDueReminderScheduler(): void {
  if (!dueReminderTimer) return
  clearInterval(dueReminderTimer)
  dueReminderTimer = null
}

function resolveRuntimeAsset(fileName: string): string {
  return is.dev
    ? join(app.getAppPath(), 'resources', fileName)
    : join(process.resourcesPath, fileName)
}

function createBackupImportErrorResult(
  code: BackupImportErrorCode,
  message: string
): BackupImportResult {
  return {
    status: 'error',
    error: {
      code,
      message
    }
  }
}

async function readBackupFile(filePath: string): Promise<unknown> {
  let fileStat: Awaited<ReturnType<typeof stat>>

  try {
    fileStat = await stat(filePath)
  } catch {
    throw createBackupImportErrorResult(
      'FILE_READ_FAILED',
      '读取备份文件失败，请检查文件权限后重试'
    )
  }

  if (fileStat.size > MAX_BACKUP_IMPORT_FILE_SIZE_BYTES) {
    throw createBackupImportErrorResult(
      'FILE_TOO_LARGE',
      `备份文件不能超过 ${Math.floor(MAX_BACKUP_IMPORT_FILE_SIZE_BYTES / 1024 / 1024)} MB`
    )
  }

  let raw: string

  try {
    raw = (await readFile(filePath, 'utf-8')).replace(/^\uFEFF/, '').trim()
  } catch {
    throw createBackupImportErrorResult(
      'FILE_READ_FAILED',
      '读取备份文件失败，请检查文件权限后重试'
    )
  }

  if (!raw) {
    throw createBackupImportErrorResult('EMPTY_FILE', '备份文件为空')
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw createBackupImportErrorResult('INVALID_JSON', '备份文件不是有效的 JSON')
  }
}

function normalizeBackupImportError(error: unknown): BackupImportResult {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 'error' &&
    'error' in error
  ) {
    return error as BackupImportResult
  }

  if (error instanceof BackupCompatibilityError) {
    if (error.code === 'UNSUPPORTED_BACKUP_FORMAT') {
      return createBackupImportErrorResult(
        'UNSUPPORTED_BACKUP_FORMAT',
        '当前文件不是 LF-Todo 备份文件'
      )
    }

    return createBackupImportErrorResult(
      'BACKUP_REQUIRES_NEWER_READER',
      '该备份由更高版本导出，当前版本暂不支持读取'
    )
  }

  if (error instanceof ContractError) {
    return createBackupImportErrorResult('INVALID_BACKUP_PAYLOAD', '备份文件结构无效或关键字段缺失')
  }

  return createBackupImportErrorResult('IMPORT_FAILED', '处理备份失败，请稍后重试')
}

async function applyBackupFromDialog(
  win: BrowserWindow,
  options: {
    dialogTitle: string
    payloadLabel: string
    apply: (payload: BackupDataPayload) => BackupImportSummary
  }
): Promise<BackupImportResult> {
  const result = await dialog.showOpenDialog(win, {
    title: options.dialogTitle,
    properties: ['openFile'],
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { status: 'cancelled' } as const
  }

  const filePath = result.filePaths[0]
  if (!filePath.toLocaleLowerCase().endsWith('.json')) {
    return createBackupImportErrorResult('INVALID_FILE_TYPE', '请选择 JSON 备份文件')
  }

  try {
    const parsed = await readBackupFile(filePath)
    const payload = parseBackupImportPayload(parsed, options.payloadLabel)
    const summary = options.apply(payload)

    return {
      status: 'success' as const,
      summary
    }
  } catch (error) {
    return normalizeBackupImportError(error)
  }
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
      title: '导出备份',
      defaultPath: `极简待办-数据备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) return false

    const data = db.exportAllData()
    const backup = buildBackupEnvelope(data, app.getVersion())
    await writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf-8')
    return true
  })

  ipcMain.handle('settings:import-data', async () => {
    const win = mainWindow
    if (!win) {
      return { status: 'cancelled' } as const
    }

    return applyBackupFromDialog(win, {
      dialogTitle: '恢复备份',
      payloadLabel: 'settings:import-data.payload',
      apply: (payload) => db.importAllData(payload)
    })
  })

  ipcMain.handle('settings:merge-import-data', async () => {
    const win = mainWindow
    if (!win) {
      return { status: 'cancelled' } as const
    }

    return applyBackupFromDialog(win, {
      dialogTitle: '合并导入备份',
      payloadLabel: 'settings:merge-import-data.payload',
      apply: (payload) => db.mergeImportData(payload)
    })
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

function registerWindowIpcHandlers(): void {
  if (windowIpcHandlersRegistered) return
  windowIpcHandlersRegistered = true

  ipcMain.on('window:resize-quick-add', (event, heightRaw: unknown) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    if (!quickAddWindow || quickAddWindow.isDestroyed() || senderWindow !== quickAddWindow) {
      return
    }

    const requestedHeight = expectInteger(heightRaw, 'window:resize-quick-add.request.height', {
      min: QUICK_ADD_WINDOW_HEIGHT_RANGE.min,
      max: QUICK_ADD_WINDOW_HEIGHT_RANGE.max
    })
    const currentBounds = quickAddWindow.getBounds()
    const display = screen.getDisplayMatching(currentBounds)
    const nextHeight = Math.min(requestedHeight, display.workArea.height)
    const nextPosition = clampWindowPosition(
      {
        x: currentBounds.x,
        y: currentBounds.y,
        width: currentBounds.width,
        height: nextHeight
      },
      display.workArea
    )

    quickAddWindow.setBounds(
      {
        ...currentBounds,
        ...nextPosition,
        height: nextHeight
      },
      true
    )
  })
}

function registerMainWindowIpcHandlers(): void {
  if (mainWindowIpcHandlersRegistered) return
  mainWindowIpcHandlersRegistered = true

  ipcMain.on('window:minimize', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    senderWindow?.minimize()
  })

  ipcMain.on('window:close', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    if (!senderWindow) return

    if (senderWindow === quickAddWindow) {
      hideQuickAddWindow()
      return
    }

    const win = getActiveMainWindow()
    if (!win || senderWindow !== win) return

    persistWindowBounds(win)
    hideQuickAddWindow()

    const closeToTray = store.get('closeToTray', true)
    if (closeToTray && tray) {
      win.hide()
      return
    }

    isAppQuitting = true
    app.quit()
  })

  ipcMain.on('window:hide-to-tray', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    const win = getActiveMainWindow()
    if (!win || senderWindow !== win) return

    hideMainWindowToTray(win)
  })

  ipcMain.on('window:quit', () => {
    const win = getActiveMainWindow()

    isAppQuitting = true

    if (win) {
      persistWindowBounds(win)
    }

    hideQuickAddWindow()
    app.quit()
  })

  ipcMain.on('window:toggle-always-on-top', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    const win = getActiveMainWindow()
    if (!win || senderWindow !== win) return

    const flag = !win.isAlwaysOnTop()
    win.setAlwaysOnTop(flag)
    store.set('alwaysOnTop', flag)
    win.webContents.send('window:always-on-top-changed', flag)
  })

  ipcMain.on('window:toggle-maximize', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    const win = getActiveMainWindow()
    if (!win || senderWindow !== win) return

    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
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

function ensureTray(): void {
  if (tray) {
    return
  }

  try {
    tray = new Tray(resolveRuntimeAsset('tray-icon.png'))

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示',
        click: () => {
          showMainWindow()
        }
      },
      {
        label: '退出',
        click: () => {
          const win = ensureMainWindow()
          if (!win) {
            isAppQuitting = true
            app.quit()
            return
          }

          showMainWindow()
          win.webContents.send('window:quit-requested')
        }
      }
    ])

    tray.setToolTip('极简待办')
    tray.setContextMenu(contextMenu)
    tray.on('click', () => {
      showMainWindow()
    })
  } catch (error) {
    tray = null
    writeStartupLog('main', 'tray initialization failed', error)
  }
}

function hideMainWindowToTray(win: BrowserWindow): void {
  if (win.isDestroyed()) return

  persistWindowBounds(win)
  hideQuickAddWindow()

  if (tray) {
    win.hide()
    return
  }

  win.minimize()
}

function bindMainWindow(win: BrowserWindow, options: { launchedHidden: boolean }): void {
  attachWindowDiagnostics(win)

  win.on('ready-to-show', () => {
    const savedOnTop = store.get('alwaysOnTop', false)
    if (savedOnTop) {
      win.setAlwaysOnTop(true)
      win.webContents.send('window:always-on-top-changed', true)
    }

    if (!options.launchedHidden) {
      win.show()
    }

    initAutoUpdater(win)

    if (is.dev) {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.on('close', (event) => {
    const closeToTray = store.get('closeToTray', true)
    if (!isAppQuitting && closeToTray && tray) {
      event.preventDefault()
      hideMainWindowToTray(win)
      return
    }

    persistWindowBounds(win)
  })

  win.on('maximize', () => {
    win.webContents.send('window:maximized-changed', true)
  })

  win.on('unmaximize', () => {
    win.webContents.send('window:maximized-changed', false)
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  loadRendererEntry(win, 'main')
}

function createWindow(): BrowserWindow {
  const existingWindow = getActiveMainWindow()
  if (existingWindow) {
    return existingWindow
  }

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
  bindMainWindow(win, { launchedHidden })
  return win

  // 初始化自动更新模块
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', () => {
  showMainWindow()
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

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
    db.archiveCompletedTasksBefore(cutoffTimestamp)
  }

  registerIpcHandlers({
    onQuickAddCommitted: notifyQuickAddCommitted
  })
  registerSettingsHandlers()
  registerWindowIpcHandlers()
  registerMainWindowIpcHandlers()

  createWindow()
  ensureTray()
  createQuickAddWindow()
  registerGlobalHotkeys()
  startDueReminderScheduler()

  app.on('activate', () => {
    if (!getActiveMainWindow()) {
      createWindow()
      return
    }

    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  isAppQuitting = true
  globalShortcut.unregisterAll()
  stopDueReminderScheduler()
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
