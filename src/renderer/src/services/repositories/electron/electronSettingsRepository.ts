import { parseBackupImportResult } from '../../../../../shared/contracts/backup'
import {
  parseAppInfo,
  parseAutoCleanupConfig,
  parsePomodoroData,
  parsePomodoroSessionState,
  parseQuickAddCommittedEvent,
  parseSettingsData,
  parseUpdateStatusData
} from '../../../../../shared/contracts/entities'
import type { SettingsRepository, UpdaterService, WindowService } from '../settingsRepository'
import { DEFAULT_FOCUS_DURATION_SECONDS } from '../../../../../shared/constants/pomodoro'
import { expectInteger } from '../../../../../shared/contracts/utils'

const noop = () => {}
const asyncNoop = async (): Promise<void> => undefined

export function createElectronSettingsRepository(
  api: Window['api'] | undefined
): SettingsRepository {
  if (!api) {
    return {
      isAvailable: false,
      async getAll() {
        return parseSettingsData(
          {
            autoLaunch: false,
            closeToTray: true,
            autoCleanup: { enabled: false, days: 7 },
            pomodoro: {
              focusDurationSeconds: DEFAULT_FOCUS_DURATION_SECONDS,
              totalCompletedCount: 0,
              activeSession: null,
              history: []
            }
          },
          'settings:fallback'
        )
      },
      async setAutoLaunch(enabled) {
        return enabled
      },
      async setCloseToTray(enabled) {
        return enabled
      },
      async setAutoCleanup(config) {
        return parseAutoCleanupConfig(config, 'settings:set-auto-cleanup.fallback')
      },
      async setPomodoroFocusDuration(durationSeconds) {
        return expectInteger(durationSeconds, 'settings:set-pomodoro-focus-duration.fallback', {
          min: 1,
          max: 86400
        })
      },
      async setPomodoroActiveSession(session) {
        return session
          ? parsePomodoroSessionState(session, 'settings:set-pomodoro-session.fallback')
          : null
      },
      async completePomodoroSession() {
        return parsePomodoroData(
          {
            focusDurationSeconds: DEFAULT_FOCUS_DURATION_SECONDS,
            totalCompletedCount: 0,
            activeSession: null,
            history: []
          },
          'settings:complete-pomodoro-session.fallback'
        )
      },
      async importData() {
        return parseBackupImportResult({ status: 'cancelled' }, 'settings:import-data.fallback')
      },
      async mergeData() {
        return parseBackupImportResult(
          { status: 'cancelled' },
          'settings:merge-import-data.fallback'
        )
      },
      async exportData() {
        return false
      },
      async getAppInfo() {
        return parseAppInfo(
          {
            name: 'LF Todo',
            version: '0.0.0',
            electron: 'N/A',
            chrome: 'N/A',
            node: 'N/A'
          },
          'settings:get-app-info.fallback'
        )
      },
      async notifyPomodoroCompleted() {
        return undefined
      }
    }
  }

  return {
    isAvailable: true,
    async getAll() {
      return parseSettingsData(await api.settings.getAll(), 'settings:get-all.response')
    },
    async setAutoLaunch(enabled) {
      return await api.settings.setAutoLaunch(enabled)
    },
    async setCloseToTray(enabled) {
      return await api.settings.setCloseToTray(enabled)
    },
    async setAutoCleanup(config) {
      return parseAutoCleanupConfig(
        await api.settings.setAutoCleanup(config),
        'settings:set-auto-cleanup.response'
      )
    },
    async setPomodoroFocusDuration(durationSeconds) {
      return expectInteger(
        await api.settings.setPomodoroFocusDuration(durationSeconds),
        'settings:set-pomodoro-focus-duration.response',
        { min: 1, max: 86400 }
      )
    },
    async setPomodoroActiveSession(session) {
      const response = await api.settings.setPomodoroActiveSession(session)
      return response === null
        ? null
        : parsePomodoroSessionState(response, 'settings:set-pomodoro-session.response')
    },
    async completePomodoroSession(session) {
      return parsePomodoroData(
        await api.settings.completePomodoroSession(session),
        'settings:complete-pomodoro-session.response'
      )
    },
    async importData() {
      return parseBackupImportResult(
        await api.settings.importData(),
        'settings:import-data.response'
      )
    },
    async mergeData() {
      return parseBackupImportResult(
        await api.settings.mergeData(),
        'settings:merge-import-data.response'
      )
    },
    async exportData() {
      return await api.settings.exportData()
    },
    async getAppInfo() {
      return parseAppInfo(await api.settings.getAppInfo(), 'settings:get-app-info.response')
    },
    async notifyPomodoroCompleted(durationSeconds) {
      await api.settings.notifyPomodoroCompleted(durationSeconds)
    }
  }
}

export function createElectronUpdaterService(api: Window['api'] | undefined): UpdaterService {
  if (!api) {
    return {
      isAvailable: false,
      checkForUpdates: asyncNoop,
      downloadUpdate: asyncNoop,
      installUpdate: asyncNoop,
      onUpdateStatus() {
        return noop
      }
    }
  }

  return {
    isAvailable: true,
    async checkForUpdates() {
      await api.updater.checkForUpdates()
    },
    async downloadUpdate() {
      await api.updater.downloadUpdate()
    },
    async installUpdate() {
      await api.updater.installUpdate()
    },
    onUpdateStatus(callback) {
      return api.updater.onUpdateStatus((data) => {
        callback(parseUpdateStatusData(data, 'updater:status.event'))
      })
    }
  }
}

export function createElectronWindowService(api: Window['api'] | undefined): WindowService {
  if (!api) {
    return {
      isAvailable: false,
      minimize: noop,
      close: noop,
      hideToTray: noop,
      quit: noop,
      toggleAlwaysOnTop: noop,
      toggleMaximize: noop,
      onQuitRequested() {
        return noop
      },
      onQuickAddCommitted() {
        return noop
      },
      onAlwaysOnTopChanged() {
        return noop
      },
      onMaximizedChanged() {
        return noop
      }
    }
  }

  return {
    isAvailable: true,
    minimize() {
      api.window.minimize()
    },
    close() {
      api.window.close()
    },
    hideToTray() {
      api.window.hideToTray()
    },
    quit() {
      api.window.quit()
    },
    toggleAlwaysOnTop() {
      api.window.toggleAlwaysOnTop()
    },
    toggleMaximize() {
      api.window.toggleMaximize()
    },
    onQuitRequested(callback) {
      return api.window.onQuitRequested(callback)
    },
    onQuickAddCommitted(callback) {
      return api.window.onQuickAddCommitted((payload) => {
        callback(parseQuickAddCommittedEvent(payload, 'window:quick-add-committed.event'))
      })
    },
    onAlwaysOnTopChanged(callback) {
      return api.window.onAlwaysOnTopChanged(callback)
    },
    onMaximizedChanged(callback) {
      return api.window.onMaximizedChanged(callback)
    }
  }
}
