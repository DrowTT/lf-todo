import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

/**
 * 初始化自动更新模块。
 * 在主窗口 ready-to-show 后调用，将更新事件通过 IPC 推送到渲染进程。
 */
export function initAutoUpdater(win: BrowserWindow): void {
  // 开发模式下跳过实际检查，仅注册 IPC handlers
  if (is.dev) {
    registerIpcHandlers(win)
    return
  }

  // 禁止自动下载，让用户手动决定
  autoUpdater.autoDownload = false
  // 允许降级（可选，根据需要开启）
  autoUpdater.allowDowngrade = false

  // ─── 更新事件 → 推送到渲染进程 ─────────────────────────────────
  autoUpdater.on('checking-for-update', () => {
    sendStatus(win, { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus(win, {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes
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

  // 注册 IPC handlers
  registerIpcHandlers(win)

  // 启动后延迟 3 秒自动检查一次
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // 静默失败，不影响正常使用
    })
  }, 3000)
}

/**
 * 向渲染进程发送更新状态
 */
function sendStatus(win: BrowserWindow, data: Record<string, unknown>): void {
  if (!win.isDestroyed()) {
    win.webContents.send('updater:status', data)
  }
}

/**
 * 注册更新相关的 IPC handlers
 */
function registerIpcHandlers(win: BrowserWindow): void {
  // 手动检查更新
  ipcMain.handle('updater:check', async () => {
    if (is.dev) {
      // 开发模式下模拟返回"已是最新"
      sendStatus(win, { status: 'not-available' })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      sendStatus(win, {
        status: 'error',
        message: error instanceof Error ? error.message : '检查更新失败'
      })
    }
  })

  // 开始下载更新
  ipcMain.handle('updater:download', async () => {
    if (is.dev) return
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      sendStatus(win, {
        status: 'error',
        message: error instanceof Error ? error.message : '下载更新失败'
      })
    }
  })

  // 退出并安装更新
  ipcMain.handle('updater:install', () => {
    if (is.dev) return
    // isSilent=true: 静默安装，不弹安装向导
    // isForceRunAfter=true: 安装完成后自动重启应用
    autoUpdater.quitAndInstall(true, true)
  })
}
