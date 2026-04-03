import type {
  AppInfo,
  AutoCleanupConfig,
  PomodoroData,
  PomodoroSessionState,
  SettingsData,
  UpdateStatusData
} from '../../../../shared/types/models'

export interface SettingsRepository {
  isAvailable: boolean
  getAll(): Promise<SettingsData>
  setAutoLaunch(enabled: boolean): Promise<boolean>
  setCloseToTray(enabled: boolean): Promise<boolean>
  setAutoCleanup(config: AutoCleanupConfig): Promise<AutoCleanupConfig>
  setPomodoroFocusDuration(durationSeconds: number): Promise<number>
  setPomodoroActiveSession(
    session: PomodoroSessionState | null
  ): Promise<PomodoroSessionState | null>
  completePomodoroSession(session: PomodoroSessionState): Promise<PomodoroData>
  exportData(): Promise<boolean>
  getAppInfo(): Promise<AppInfo>
  notifyPomodoroCompleted(durationSeconds: number): Promise<void>
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
  quit(): void
  toggleAlwaysOnTop(): void
  toggleMaximize(): void
  onQuitRequested(callback: () => void): () => void
  onAlwaysOnTopChanged(callback: (flag: boolean) => void): () => void
  onMaximizedChanged(callback: (flag: boolean) => void): () => void
}
