import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { readStoredJson, writeStoredJson } from '../utils/localStorage'

interface SessionSnapshot {
  settingsPanelOpen: boolean
  taskDrafts: Record<string, string>
  subTaskDrafts: Record<string, string>
}

const STORAGE_KEY = 'lf-todo:app-session'

function loadSnapshot(): SessionSnapshot {
  const parsed = readStoredJson<Partial<SessionSnapshot>>(STORAGE_KEY, {})

  return {
    settingsPanelOpen: parsed.settingsPanelOpen ?? false,
    taskDrafts: parsed.taskDrafts ?? {},
    subTaskDrafts: parsed.subTaskDrafts ?? {}
  }
}

export const useAppSessionStore = defineStore('appSession', () => {
  const hydrated = ref(false)
  const settingsPanelOpen = ref(false)
  const taskDrafts = ref<Record<string, string>>({})
  const subTaskDrafts = ref<Record<string, string>>({})

  const hasDrafts = computed(
    () =>
      Object.values(taskDrafts.value).some(Boolean) ||
      Object.values(subTaskDrafts.value).some(Boolean)
  )

  function persist() {
    const snapshot: SessionSnapshot = {
      settingsPanelOpen: settingsPanelOpen.value,
      taskDrafts: taskDrafts.value,
      subTaskDrafts: subTaskDrafts.value
    }
    writeStoredJson(STORAGE_KEY, snapshot)
  }

  function hydrate() {
    if (hydrated.value) return

    const snapshot = loadSnapshot()
    settingsPanelOpen.value = snapshot.settingsPanelOpen
    taskDrafts.value = snapshot.taskDrafts
    subTaskDrafts.value = snapshot.subTaskDrafts
    hydrated.value = true
  }

  function setSettingsPanelOpen(open: boolean) {
    settingsPanelOpen.value = open
    persist()
  }

  function getTaskDraft(categoryId: number | null) {
    if (!categoryId) return ''
    return taskDrafts.value[String(categoryId)] ?? ''
  }

  function setTaskDraft(categoryId: number | null, content: string) {
    if (!categoryId) return

    const key = String(categoryId)
    if (content) {
      taskDrafts.value = { ...taskDrafts.value, [key]: content }
    } else if (key in taskDrafts.value) {
      const next = { ...taskDrafts.value }
      delete next[key]
      taskDrafts.value = next
    }

    persist()
  }

  function clearTaskDraft(categoryId: number | null) {
    setTaskDraft(categoryId, '')
  }

  function getSubTaskDraft(parentId: number) {
    return subTaskDrafts.value[String(parentId)] ?? ''
  }

  function setSubTaskDraft(parentId: number, content: string) {
    const key = String(parentId)
    if (content) {
      subTaskDrafts.value = { ...subTaskDrafts.value, [key]: content }
    } else if (key in subTaskDrafts.value) {
      const next = { ...subTaskDrafts.value }
      delete next[key]
      subTaskDrafts.value = next
    }

    persist()
  }

  function clearSubTaskDraft(parentId: number) {
    setSubTaskDraft(parentId, '')
  }

  return {
    hydrated,
    settingsPanelOpen,
    taskDrafts,
    subTaskDrafts,
    hasDrafts,
    hydrate,
    setSettingsPanelOpen,
    getTaskDraft,
    setTaskDraft,
    clearTaskDraft,
    getSubTaskDraft,
    setSubTaskDraft,
    clearSubTaskDraft
  }
})
