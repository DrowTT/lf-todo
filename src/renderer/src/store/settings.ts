import { ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AppInfo,
  AutoCleanupConfig,
  PomodoroData,
  PomodoroSessionState,
  SettingsData
} from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'
import { DEFAULT_FOCUS_DURATION_SECONDS } from '../../../shared/constants/pomodoro'

const defaultSettings = (): SettingsData => ({
  autoLaunch: false,
  closeToTray: true,
  autoCleanup: {
    enabled: false,
    days: 7
  },
  pomodoro: {
    focusDurationSeconds: DEFAULT_FOCUS_DURATION_SECONDS,
    totalCompletedCount: 0,
    activeSession: null,
    history: []
  }
})

const defaultAppInfo = (): AppInfo => ({
  name: '极简待办',
  version: '0.0.0',
  electron: '',
  chrome: '',
  node: ''
})

export const useSettingsStore = defineStore('settings', () => {
  const runtime = useAppRuntime()
  const repository = runtime.repositories.settings

  const settings = ref<SettingsData>(defaultSettings())
  const appInfo = ref<AppInfo>(defaultAppInfo())
  const isLoading = ref(false)
  const isExporting = ref(false)
  const isSavingAutoLaunch = ref(false)
  const isSavingCloseToTray = ref(false)
  const isSavingAutoCleanup = ref(false)
  const isSavingPomodoro = ref(false)
  const isSavingPomodoroDuration = ref(false)
  const error = ref('')
  const loadError = ref('')
  const lastSyncedAt = ref<number | null>(null)
  const hydrated = ref(false)

  function markSynced() {
    lastSyncedAt.value = Date.now()
    error.value = ''
  }

  async function load() {
    if (!repository.isAvailable) {
      hydrated.value = true
      return
    }

    isLoading.value = true
    error.value = ''
    loadError.value = ''

    try {
      const [nextSettings, nextAppInfo] = await Promise.all([
        repository.getAll(),
        repository.getAppInfo()
      ])

      settings.value = nextSettings
      appInfo.value = nextAppInfo
      hydrated.value = true
      loadError.value = ''
      markSynced()
    } catch (err) {
      loadError.value = '设置加载失败，建议先重启应用；如果仍然失败，请检查系统权限或稍后重试。'
      error.value = '加载设置失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function hydrate() {
    if (hydrated.value) return
    await load()
  }

  async function setAutoLaunch(enabled: boolean) {
    if (!repository.isAvailable) return false

    const previous = settings.value.autoLaunch
    settings.value = { ...settings.value, autoLaunch: enabled }
    isSavingAutoLaunch.value = true

    try {
      const actualEnabled = await repository.setAutoLaunch(enabled)
      settings.value = { ...settings.value, autoLaunch: actualEnabled }
      markSynced()

      if (actualEnabled !== enabled) {
        runtime.toast.show(
          enabled
            ? '当前运行环境未成功启用开机自启，请使用打包后的应用或检查系统启动项'
            : '系统未成功关闭开机自启，请检查系统启动项设置'
        )
      }

      return actualEnabled
    } catch (err) {
      settings.value = { ...settings.value, autoLaunch: previous }
      error.value = '保存开机自启失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isSavingAutoLaunch.value = false
    }
  }

  async function setCloseToTray(enabled: boolean) {
    if (!repository.isAvailable) return false

    const previous = settings.value.closeToTray
    settings.value = { ...settings.value, closeToTray: enabled }
    isSavingCloseToTray.value = true

    try {
      await repository.setCloseToTray(enabled)
      markSynced()
      return true
    } catch (err) {
      settings.value = { ...settings.value, closeToTray: previous }
      error.value = '保存关闭行为失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isSavingCloseToTray.value = false
    }
  }

  async function setAutoCleanup(config: AutoCleanupConfig) {
    if (!repository.isAvailable) return false

    const previous = settings.value.autoCleanup
    settings.value = { ...settings.value, autoCleanup: { ...config } }
    isSavingAutoCleanup.value = true

    try {
      const nextConfig = await repository.setAutoCleanup(config)
      settings.value = { ...settings.value, autoCleanup: nextConfig }
      markSynced()
      return true
    } catch (err) {
      settings.value = { ...settings.value, autoCleanup: previous }
      error.value = '保存自动归档设置失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isSavingAutoCleanup.value = false
    }
  }

  async function exportData() {
    if (!repository.isAvailable || isExporting.value) return false

    isExporting.value = true
    error.value = ''

    try {
      const exported = await repository.exportData()
      if (exported) {
        runtime.toast.show('导出完成', 'success')
      }
      markSynced()
      return exported
    } catch (err) {
      error.value = '导出数据失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isExporting.value = false
    }
  }

  async function setPomodoroFocusDuration(durationSeconds: number) {
    if (!repository.isAvailable) return false

    const previous = settings.value.pomodoro.focusDurationSeconds
    settings.value = {
      ...settings.value,
      pomodoro: { ...settings.value.pomodoro, focusDurationSeconds: durationSeconds }
    }
    isSavingPomodoroDuration.value = true

    try {
      const nextDuration = await repository.setPomodoroFocusDuration(durationSeconds)
      settings.value = {
        ...settings.value,
        pomodoro: { ...settings.value.pomodoro, focusDurationSeconds: nextDuration }
      }
      markSynced()
      return true
    } catch (err) {
      settings.value = {
        ...settings.value,
        pomodoro: { ...settings.value.pomodoro, focusDurationSeconds: previous }
      }
      error.value = '保存番茄钟时长失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isSavingPomodoroDuration.value = false
    }
  }

  async function setPomodoroActiveSession(session: PomodoroSessionState | null) {
    const previous = settings.value.pomodoro.activeSession
    settings.value = {
      ...settings.value,
      pomodoro: {
        ...settings.value.pomodoro,
        activeSession: session
      }
    }

    if (!repository.isAvailable) {
      return session
    }

    isSavingPomodoro.value = true

    try {
      const nextSession = await repository.setPomodoroActiveSession(session)
      settings.value = {
        ...settings.value,
        pomodoro: {
          ...settings.value.pomodoro,
          activeSession: nextSession
        }
      }
      markSynced()
      return nextSession
    } catch (err) {
      settings.value = {
        ...settings.value,
        pomodoro: {
          ...settings.value.pomodoro,
          activeSession: previous
        }
      }
      error.value = '保存番茄钟状态失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isSavingPomodoro.value = false
    }
  }

  async function completePomodoroSession(session: PomodoroSessionState): Promise<PomodoroData> {
    const previous = settings.value.pomodoro

    if (!repository.isAvailable) {
      const completedAt = Date.now()
      const nextPomodoro: PomodoroData = {
        ...previous,
        totalCompletedCount: previous.totalCompletedCount + 1,
        activeSession: null,
        history: [
          ...previous.history,
          {
            id: `${completedAt}-fallback`,
            completedAt,
            durationSeconds: session.durationSeconds,
            source: session.source,
            taskId: session.taskId,
            taskContentSnapshot: session.taskContentSnapshot
          }
        ]
      }

      settings.value = { ...settings.value, pomodoro: nextPomodoro }
      return nextPomodoro
    }

    isSavingPomodoro.value = true

    try {
      const nextPomodoro = await repository.completePomodoroSession(session)
      settings.value = { ...settings.value, pomodoro: nextPomodoro }
      markSynced()
      return nextPomodoro
    } catch (err) {
      settings.value = { ...settings.value, pomodoro: previous }
      error.value = '记录番茄钟失败，请重试'
      runtime.toast.show(error.value)
      throw err
    } finally {
      isSavingPomodoro.value = false
    }
  }

  async function notifyPomodoroCompleted(durationSeconds: number) {
    if (!repository.isAvailable) return
    await repository.notifyPomodoroCompleted(durationSeconds)
  }

  return {
    isAvailable: repository.isAvailable,
    settings,
    appInfo,
    isLoading,
    isExporting,
    isSavingAutoLaunch,
    isSavingCloseToTray,
    isSavingAutoCleanup,
    isSavingPomodoro,
    isSavingPomodoroDuration,
    error,
    loadError,
    lastSyncedAt,
    hydrated,
    hydrate,
    load,
    setAutoLaunch,
    setCloseToTray,
    setAutoCleanup,
    setPomodoroFocusDuration,
    setPomodoroActiveSession,
    completePomodoroSession,
    notifyPomodoroCompleted,
    exportData
  }
})
