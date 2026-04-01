import { onMounted, ref } from 'vue'
import { useAppFacade } from './facade/useAppFacade'

async function bootstrapRuntimeFeatures() {
  await Promise.all([
    Promise.resolve(), // Reserved for settings bootstrap.
    Promise.resolve(), // Reserved for updater bootstrap.
    Promise.resolve() // Reserved for draft recovery.
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
