import type {
  AppInfo,
  AutoCleanupConfig,
  SettingsData,
  UpdateStatusData
} from '../../../../shared/types/models'

export interface SettingsRepository {
  isAvailable: boolean
  getAll(): Promise<SettingsData>
  setAutoLaunch(enabled: boolean): Promise<boolean>
  setCloseToTray(enabled: boolean): Promise<boolean>
  setAutoCleanup(config: AutoCleanupConfig): Promise<AutoCleanupConfig>
  exportData(): Promise<boolean>
  getAppInfo(): Promise<AppInfo>
}

export interface UpdaterService {
  isAvailable: boolean
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  onUpdateStatus(callback: (data: UpdateStatusData) => void): () => void
}

export interface WindowService {
  isAvailable: boolean
  minimize(): void
  close(): void
  toggleAlwaysOnTop(): void
  toggleMaximize(): void
  onAlwaysOnTopChanged(callback: (flag: boolean) => void): () => void
  onMaximizedChanged(callback: (flag: boolean) => void): () => void
}
