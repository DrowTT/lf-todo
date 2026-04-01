import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { UpdateStatusData } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'

type UpdaterStatus = UpdateStatusData['status'] | 'idle'

export const useUpdaterStore = defineStore('updater', () => {
  const runtime = useAppRuntime()
  const service = runtime.updater

  const status = ref<UpdaterStatus>('idle')
  const version = ref('')
  const percent = ref(0)
  const error = ref('')
  const lastSyncedAt = ref<number | null>(null)
  const initialized = ref(false)
  let stopListening: (() => void) | null = null

  function syncFromEvent(data: UpdateStatusData) {
    status.value = data.status
    const nextStatus = data.status

    if ('version' in data) {
      version.value = data.version
    }

    if ('percent' in data) {
      percent.value = data.percent
    } else if (nextStatus !== 'downloading') {
      percent.value = 0
    }

    error.value = nextStatus === 'error' ? data.message : ''
    lastSyncedAt.value = Date.now()
  }

  function initialize() {
    if (!service.isAvailable || initialized.value) return

    stopListening?.()
    stopListening = service.onUpdateStatus(syncFromEvent)
    initialized.value = true
  }

  async function checkForUpdates() {
    if (!service.isAvailable) return false

    initialize()
    status.value = 'checking'
    error.value = ''

    try {
      await service.checkForUpdates()
      lastSyncedAt.value = Date.now()
      return true
    } catch (err) {
      status.value = 'error'
      error.value = '检查更新失败，请重试'
      runtime.toast.show(error.value)
      throw err
    }
  }

  async function downloadUpdate() {
    if (!service.isAvailable) return false

    initialize()
    percent.value = 0
    error.value = ''

    try {
      await service.downloadUpdate()
      lastSyncedAt.value = Date.now()
      return true
    } catch (err) {
      status.value = 'error'
      error.value = '下载更新失败，请重试'
      runtime.toast.show(error.value)
      throw err
    }
  }

  async function installUpdate() {
    if (!service.isAvailable) return false

    try {
      await service.installUpdate()
      return true
    } catch (err) {
      status.value = 'error'
      error.value = '安装更新失败，请重试'
      runtime.toast.show(error.value)
      throw err
    }
  }

  return {
    isAvailable: service.isAvailable,
    status,
    version,
    percent,
    error,
    lastSyncedAt,
    initialized,
    initialize,
    checkForUpdates,
    downloadUpdate,
    installUpdate
  }
})
