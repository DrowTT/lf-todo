import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { parseUpdateStatusData } from '../shared/contracts/entities'
import { parseNoPayloadRequest } from '../shared/contracts/updater'

export function initAutoUpdater(win: BrowserWindow): void {
  if (is.dev) {
    registerIpcHandlers(win)
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    sendStatus(win, { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus(win, {
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
    sendStatus(win, { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus(win, {
      status: 'downloading',
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus(win, {
      status: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (error) => {
    sendStatus(win, {
      status: 'error',
      message: error.message
    })
  })

  registerIpcHandlers(win)

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      return undefined
    })
  }, 3000)
}

function sendStatus(win: BrowserWindow, data: Record<string, unknown>): void {
  if (!win.isDestroyed()) {
    win.webContents.send('updater:status', parseUpdateStatusData(data, 'updater:status.event'))
  }
}

function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('updater:check', async (_event, payload: unknown) => {
    parseNoPayloadRequest(payload, 'updater:check.request')

    if (is.dev) {
      sendStatus(win, { status: 'not-available' })
      return
    }

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      sendStatus(win, {
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
      sendStatus(win, {
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
