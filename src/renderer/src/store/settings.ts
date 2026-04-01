import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AppInfo, AutoCleanupConfig, SettingsData } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'

const defaultSettings = (): SettingsData => ({
  autoLaunch: false,
  closeToTray: true,
  autoCleanup: {
    enabled: false,
    days: 7
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
  const error = ref('')
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

    try {
      const [nextSettings, nextAppInfo] = await Promise.all([
        repository.getAll(),
        repository.getAppInfo()
      ])

      settings.value = nextSettings
      appInfo.value = nextAppInfo
      hydrated.value = true
      markSynced()
    } catch (err) {
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
      await repository.setAutoLaunch(enabled)
      markSynced()
      return true
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
      error.value = '保存自动清理设置失败，请重试'
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

  return {
    isAvailable: repository.isAvailable,
    settings,
    appInfo,
    isLoading,
    isExporting,
    isSavingAutoLaunch,
    isSavingCloseToTray,
    isSavingAutoCleanup,
    error,
    lastSyncedAt,
    hydrated,
    hydrate,
    load,
    setAutoLaunch,
    setCloseToTray,
    setAutoCleanup,
    exportData
  }
})
