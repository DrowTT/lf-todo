import {
  parseAppInfo,
  parseAutoCleanupConfig,
  parseSettingsData,
  parseUpdateStatusData
} from '../../../../../shared/contracts/entities'
import type { SettingsRepository, UpdaterService, WindowService } from '../settingsRepository'

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
            autoCleanup: { enabled: false, days: 7 }
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
    async exportData() {
      return await api.settings.exportData()
    },
    async getAppInfo() {
      return parseAppInfo(await api.settings.getAppInfo(), 'settings:get-app-info.response')
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
      toggleAlwaysOnTop: noop,
      toggleMaximize: noop,
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
    toggleAlwaysOnTop() {
      api.window.toggleAlwaysOnTop()
    },
    toggleMaximize() {
      api.window.toggleMaximize()
    },
    onAlwaysOnTopChanged(callback) {
      return api.window.onAlwaysOnTopChanged(callback)
    },
    onMaximizedChanged(callback) {
      return api.window.onMaximizedChanged(callback)
    }
  }
}
