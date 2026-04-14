import { ref } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_TASK_PRIORITY, TASK_PRIORITY_VALUES } from '../../../shared/constants/task'
import type { TaskDueState, TaskPriority } from '../../../shared/types/models'
import { readStoredJson, writeStoredJson } from '../utils/localStorage'

export type MainView = 'tasks' | 'pomodoro' | 'settings'

interface SessionSnapshot {
  currentMainView: MainView
  taskDrafts: Record<string, string>
  taskDueDrafts: Record<string, TaskDueState>
  taskPriorityDrafts: Record<string, TaskPriority>
  subTaskDrafts: Record<string, string>
}

const STORAGE_KEY = 'lf-todo:app-session'

function loadSnapshot(): SessionSnapshot {
  const parsed = readStoredJson<Partial<SessionSnapshot>>(STORAGE_KEY, {})

  return {
    currentMainView:
      parsed.currentMainView === 'pomodoro'
        ? 'pomodoro'
        : parsed.currentMainView === 'settings'
          ? 'settings'
          : 'tasks',
    taskDrafts: parsed.taskDrafts ?? {},
    taskDueDrafts: normalizeTaskDueDrafts(parsed.taskDueDrafts),
    taskPriorityDrafts: normalizeTaskPriorityDrafts(parsed.taskPriorityDrafts),
    subTaskDrafts: parsed.subTaskDrafts ?? {}
  }
}

function normalizeTaskDueDrafts(value: unknown): Record<string, TaskDueState> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const next: Record<string, TaskDueState> = {}

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') {
      continue
    }

    const record = raw as Record<string, unknown>
    const dueAt = typeof record.due_at === 'number' ? record.due_at : null
    const duePrecision =
      record.due_precision === 'date' || record.due_precision === 'datetime'
        ? record.due_precision
        : null

    if ((dueAt === null) !== (duePrecision === null)) {
      continue
    }

    next[key] = {
      due_at: dueAt,
      due_precision: duePrecision
    }
  }

  return next
}

function cloneTaskDueState(value: TaskDueState): TaskDueState {
  return {
    due_at: value.due_at,
    due_precision: value.due_precision
  }
}

function normalizeTaskPriorityDrafts(value: unknown): Record<string, TaskPriority> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const next: Record<string, TaskPriority> = {}

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof raw === 'string' &&
      TASK_PRIORITY_VALUES.includes(raw as TaskPriority) &&
      raw !== DEFAULT_TASK_PRIORITY
    ) {
      next[key] = raw as TaskPriority
    }
  }

  return next
}

export const useAppSessionStore = defineStore('appSession', () => {
  const hydrated = ref(false)
  const currentMainView = ref<MainView>('tasks')
  const taskDrafts = ref<Record<string, string>>({})
  const taskDueDrafts = ref<Record<string, TaskDueState>>({})
  const taskPriorityDrafts = ref<Record<string, TaskPriority>>({})
  const subTaskDrafts = ref<Record<string, string>>({})

  function persist() {
    const snapshot: SessionSnapshot = {
      currentMainView: currentMainView.value,
      taskDrafts: taskDrafts.value,
      taskDueDrafts: taskDueDrafts.value,
      taskPriorityDrafts: taskPriorityDrafts.value,
      subTaskDrafts: subTaskDrafts.value
    }
    writeStoredJson(STORAGE_KEY, snapshot)
  }

  function hydrate() {
    if (hydrated.value) return

    const snapshot = loadSnapshot()
    currentMainView.value = snapshot.currentMainView
    taskDrafts.value = snapshot.taskDrafts
    taskDueDrafts.value = snapshot.taskDueDrafts
    taskPriorityDrafts.value = snapshot.taskPriorityDrafts
    subTaskDrafts.value = snapshot.subTaskDrafts
    hydrated.value = true
  }

  function setCurrentMainView(view: MainView) {
    currentMainView.value = view
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

  function getTaskDueDraft(categoryId: number | null): TaskDueState {
    if (!categoryId) {
      return { due_at: null, due_precision: null }
    }

    return cloneTaskDueState(
      taskDueDrafts.value[String(categoryId)] ?? { due_at: null, due_precision: null }
    )
  }

  function setTaskDueDraft(categoryId: number | null, dueState: TaskDueState) {
    if (!categoryId) return

    const key = String(categoryId)
    const hasDueDate = dueState.due_at !== null && dueState.due_precision !== null

    if (hasDueDate) {
      taskDueDrafts.value = {
        ...taskDueDrafts.value,
        [key]: cloneTaskDueState(dueState)
      }
    } else if (key in taskDueDrafts.value) {
      const next = { ...taskDueDrafts.value }
      delete next[key]
      taskDueDrafts.value = next
    }

    persist()
  }

  function clearTaskDueDraft(categoryId: number | null) {
    setTaskDueDraft(categoryId, { due_at: null, due_precision: null })
  }

  function getTaskPriorityDraft(categoryId: number | null): TaskPriority {
    if (!categoryId) {
      return DEFAULT_TASK_PRIORITY
    }

    return taskPriorityDrafts.value[String(categoryId)] ?? DEFAULT_TASK_PRIORITY
  }

  function setTaskPriorityDraft(categoryId: number | null, priority: TaskPriority) {
    if (!categoryId) return

    const key = String(categoryId)

    if (priority !== DEFAULT_TASK_PRIORITY) {
      taskPriorityDrafts.value = {
        ...taskPriorityDrafts.value,
        [key]: priority
      }
    } else if (key in taskPriorityDrafts.value) {
      const next = { ...taskPriorityDrafts.value }
      delete next[key]
      taskPriorityDrafts.value = next
    }

    persist()
  }

  function clearTaskPriorityDraft(categoryId: number | null) {
    setTaskPriorityDraft(categoryId, DEFAULT_TASK_PRIORITY)
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
    currentMainView,
    taskDrafts,
    taskDueDrafts,
    taskPriorityDrafts,
    subTaskDrafts,
    hydrate,
    setCurrentMainView,
    getTaskDraft,
    setTaskDraft,
    clearTaskDraft,
    getTaskDueDraft,
    setTaskDueDraft,
    clearTaskDueDraft,
    getTaskPriorityDraft,
    setTaskPriorityDraft,
    clearTaskPriorityDraft,
    getSubTaskDraft,
    setSubTaskDraft,
    clearSubTaskDraft
  }
})
