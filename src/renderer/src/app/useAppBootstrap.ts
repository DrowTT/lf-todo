import { onMounted, ref } from 'vue'
import { useAppFacade } from './facade/useAppFacade'
import { useSettingsStore } from '../store/settings'
import { useUpdaterStore } from '../store/updater'

async function bootstrapRuntimeFeatures() {
  const settingsStore = useSettingsStore()
  const updaterStore = useUpdaterStore()

  updaterStore.initialize()
  await settingsStore.hydrate()
}

export function useAppBootstrap() {
  const app = useAppFacade()

  const hasBootstrapped = ref(false)
  const isBootstrapping = ref(false)

  onMounted(async () => {
    if (hasBootstrapped.value) return

    isBootstrapping.value = true

    try {
      await app.fetchCategories()
      await bootstrapRuntimeFeatures()
      hasBootstrapped.value = true
    } catch (error) {
      console.error('[appBootstrap] bootstrap failed', error)
    } finally {
      isBootstrapping.value = false
    }
  })

  return {
    isBootstrapping
  }
}
