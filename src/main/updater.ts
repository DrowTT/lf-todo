import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { parseUpdateStatusData } from '../shared/contracts/entities'
import { parseNoPayloadRequest } from '../shared/contracts/updater'

let updaterHandlersRegistered = false
let updaterEventsRegistered = false
let initialUpdateCheckScheduled = false
let targetWindow: BrowserWindow | null = null

export function initAutoUpdater(win: BrowserWindow): void {
  targetWindow = win
  registerIpcHandlers()

  if (is.dev) {
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.allowDowngrade = false
  registerAutoUpdaterEvents()
  scheduleInitialUpdateCheck()
}

function getTargetWindow(): BrowserWindow | null {
  if (!targetWindow || targetWindow.isDestroyed()) {
    targetWindow = null
    return null
  }

  return targetWindow
}

function sendStatus(data: Record<string, unknown>): void {
  const win = getTargetWindow()
  if (!win) return

  win.webContents.send('updater:status', parseUpdateStatusData(data, 'updater:status.event'))
}

function registerAutoUpdaterEvents(): void {
  if (updaterEventsRegistered) return
  updaterEventsRegistered = true

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({
      status: 'available',
      version: info.version,
      releaseNotes: Array.isArray(info.releaseNotes)
        ? info.releaseNotes.join('\n')
        : typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({
      status: 'downloading',
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({
      status: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (error) => {
    sendStatus({
      status: 'error',
      message: error.message
    })
  })
}

function scheduleInitialUpdateCheck(): void {
  if (initialUpdateCheckScheduled) return
  initialUpdateCheckScheduled = true

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      return undefined
    })
  }, 3000)
}

function registerIpcHandlers(): void {
  if (updaterHandlersRegistered) return
  updaterHandlersRegistered = true

  ipcMain.handle('updater:check', async (_event, payload: unknown) => {
    parseNoPayloadRequest(payload, 'updater:check.request')

    if (is.dev) {
      sendStatus({ status: 'not-available' })
      return
    }

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      sendStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to check for updates'
      })
    }
  })

  ipcMain.handle('updater:download', async (_event, payload: unknown) => {
    parseNoPayloadRequest(payload, 'updater:download.request')

    if (is.dev) return

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      sendStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to download update'
      })
    }
  })

  ipcMain.handle('updater:install', (_event, payload: unknown) => {
    parseNoPayloadRequest(payload, 'updater:install.request')

    if (is.dev) return

    autoUpdater.quitAndInstall()
  })
}
