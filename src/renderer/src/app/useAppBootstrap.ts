import { onMounted, ref } from 'vue'
import { useAppFacade } from './facade/useAppFacade'
import { useAppSessionStore } from '../store/appSession'
import { useSettingsStore } from '../store/settings'
import { useUpdaterStore } from '../store/updater'

async function bootstrapRuntimeFeatures() {
  const appSessionStore = useAppSessionStore()
  const settingsStore = useSettingsStore()
  const updaterStore = useUpdaterStore()

  await Promise.all([
    settingsStore.hydrate(),
    Promise.resolve().then(() => updaterStore.initialize()),
    Promise.resolve().then(() => appSessionStore.hydrate())
  ])
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
