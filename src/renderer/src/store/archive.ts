import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ArchivedTaskGroup } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'

export const useArchiveStore = defineStore('archive', () => {
  const groups = ref<ArchivedTaskGroup[]>([])
  const isLoading = ref(false)
  const isRestoring = ref(false)
  const selectedIds = ref<number[]>([])

  const { repositories, toast } = useAppRuntime()
  const taskRepository = repositories.task

  const selectedCount = computed(() => selectedIds.value.length)

  function setGroups(nextGroups: ArchivedTaskGroup[]) {
    groups.value = nextGroups
    const validIds = new Set(nextGroups.map((group) => group.task.id))
    selectedIds.value = selectedIds.value.filter((id) => validIds.has(id))
  }

  async function fetchGroups() {
    isLoading.value = true

    try {
      setGroups(await taskRepository.getArchivedTaskGroups())
    } catch (error) {
      console.error('[archiveStore] fetchGroups failed', error)
      toast.show('加载归档失败，请重试')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function clearSelection() {
    selectedIds.value = []
  }

  function isSelected(id: number) {
    return selectedIds.value.includes(id)
  }

  function toggleSelected(id: number, checked?: boolean) {
    const selected = isSelected(id)
    const shouldSelect = checked ?? !selected

    if (shouldSelect && !selected) {
      selectedIds.value = [...selectedIds.value, id]
      return
    }

    if (!shouldSelect && selected) {
      selectedIds.value = selectedIds.value.filter((item) => item !== id)
    }
  }

  function removeGroups(ids: number[]) {
    const idSet = new Set(ids)
    groups.value = groups.value.filter((group) => !idSet.has(group.task.id))
    selectedIds.value = selectedIds.value.filter((id) => !idSet.has(id))
  }

  async function restoreTasks(ids: number[]) {
    if (ids.length === 0) {
      return 0
    }

    isRestoring.value = true

    try {
      const restoredCount = await taskRepository.restoreArchivedTasks(ids)
      removeGroups(ids)
      return restoredCount
    } catch (error) {
      console.error('[archiveStore] restoreTasks failed', error)
      toast.show('恢复归档失败，请重试')
      throw error
    } finally {
      isRestoring.value = false
    }
  }

  return {
    groups,
    isLoading,
    isRestoring,
    selectedIds,
    selectedCount,
    setGroups,
    fetchGroups,
    clearSelection,
    isSelected,
    toggleSelected,
    removeGroups,
    restoreTasks
  }
})
