import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import type { PomodoroRecord, PomodoroSessionState, Task } from '../../../shared/types/models'
import {
  createPomodoroStartMessage,
  formatPomodoroDurationLabel
} from '../../../shared/constants/pomodoro'
import { useAppRuntime } from '../app/runtime'
import { useSettingsStore } from './settings'

const SECOND = 1000

function createSession(
  durationSeconds: number,
  options: Pick<PomodoroSessionState, 'source' | 'taskId' | 'taskContentSnapshot'>
): PomodoroSessionState {
  const startedAt = Date.now()

  return {
    startedAt,
    endsAt: startedAt + durationSeconds * SECOND,
    durationSeconds,
    source: options.source,
    taskId: options.taskId,
    taskContentSnapshot: options.taskContentSnapshot
  }
}

function getDayStart(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function getWeekStart(timestamp: number): number {
  const date = new Date(getDayStart(timestamp))
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.getTime()
}

function countRecords(
  records: PomodoroRecord[],
  predicate: (record: PomodoroRecord) => boolean
): number {
  return records.reduce((total, record) => total + (predicate(record) ? 1 : 0), 0)
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const runtime = useAppRuntime()
  const settingsStore = useSettingsStore()

  const now = ref(Date.now())
  const initialized = ref(false)
  const isBusy = ref(false)

  let tickTimer: ReturnType<typeof setInterval> | null = null
  let completionPromise: Promise<void> | null = null

  const activeSession = computed(() => settingsStore.settings.pomodoro.activeSession)
  const history = computed(() => settingsStore.settings.pomodoro.history)
  const focusDurationSeconds = computed(() => settingsStore.settings.pomodoro.focusDurationSeconds)
  const focusDurationLabel = computed(() => formatPomodoroDurationLabel(focusDurationSeconds.value))
  const totalCompletedCount = computed(() => settingsStore.settings.pomodoro.totalCompletedCount)
  const remainingSeconds = computed(() => {
    const session = activeSession.value
    if (!session) return focusDurationSeconds.value
    return Math.max(0, Math.ceil((session.endsAt - now.value) / SECOND))
  })
  const formattedRemaining = computed(() => formatDuration(remainingSeconds.value))
  const progressRatio = computed(() => {
    const session = activeSession.value
    if (!session || session.durationSeconds <= 0) return 0
    return Math.min(
      1,
      Math.max(0, (session.durationSeconds - remainingSeconds.value) / session.durationSeconds)
    )
  })
  const isRunning = computed(() => activeSession.value !== null)
  const activeTaskLabel = computed(() => activeSession.value?.taskContentSnapshot ?? null)
  const taskPomodoroCountMap = computed(() => {
    const counts: Record<number, number> = {}

    history.value.forEach((record) => {
      if (!record.taskId) return
      counts[record.taskId] = (counts[record.taskId] ?? 0) + 1
    })

    return counts
  })
  const todayCompletedCount = computed(() => {
    const todayStart = getDayStart(Date.now())
    return countRecords(history.value, (record) => record.completedAt >= todayStart)
  })
  const weekCompletedCount = computed(() => {
    const weekStart = getWeekStart(Date.now())
    return countRecords(history.value, (record) => record.completedAt >= weekStart)
  })
  const taskCompletedCount = computed(() =>
    countRecords(history.value, (record) => record.source === 'task' && record.taskId !== null)
  )

  function stopTicking() {
    if (!tickTimer) return
    clearInterval(tickTimer)
    tickTimer = null
  }

  function startTicking() {
    if (tickTimer) return
    tickTimer = setInterval(() => {
      now.value = Date.now()
      void syncCompletionIfNeeded()
    }, SECOND)
  }

  async function finalizeSession(session: PomodoroSessionState) {
    isBusy.value = true

    try {
      await settingsStore.completePomodoroSession(session)
      stopTicking()
      await settingsStore.notifyPomodoroCompleted(session.durationSeconds)
      runtime.toast.show('番茄钟完成，已记录 1 个番茄。', 'success', { duration: 5000 })
    } finally {
      isBusy.value = false
    }
  }

  async function syncCompletionIfNeeded() {
    const session = activeSession.value

    if (!session || now.value < session.endsAt || completionPromise) {
      return
    }

    // toRaw 解包 Vue Proxy，避免 contextBridge structuredClone 序列化失败
    completionPromise = finalizeSession(toRaw(session))

    try {
      await completionPromise
    } finally {
      completionPromise = null
    }
  }

  async function hydrate() {
    if (initialized.value) return

    await settingsStore.hydrate()
    initialized.value = true
    now.value = Date.now()

    if (activeSession.value) {
      startTicking()
      await syncCompletionIfNeeded()
    }
  }

  async function start() {
    if (isRunning.value || isBusy.value) return

    isBusy.value = true

    try {
      const session = createSession(focusDurationSeconds.value, {
        source: 'global',
        taskId: null,
        taskContentSnapshot: null
      })
      await settingsStore.setPomodoroActiveSession(session)
      now.value = Date.now()
      startTicking()
      runtime.toast.show(createPomodoroStartMessage(session.durationSeconds), 'info')
    } finally {
      isBusy.value = false
    }
  }

  async function cancel() {
    if (!isRunning.value || isBusy.value) return

    isBusy.value = true

    try {
      await settingsStore.setPomodoroActiveSession(null)
      stopTicking()
      runtime.toast.show('当前番茄钟已取消，不会记录本次专注。', 'info')
    } finally {
      isBusy.value = false
    }
  }

  async function startForTask(task: Task) {
    if (isBusy.value) return false

    if (activeSession.value) {
      if (activeSession.value.taskId === task.id) {
        runtime.toast.show('这个任务的番茄钟已经在进行了。', 'info')
      } else {
        runtime.toast.show('已有进行中的番茄钟，请先完成或取消当前会话。', 'info')
      }
      return false
    }

    isBusy.value = true

    try {
      const session = createSession(focusDurationSeconds.value, {
        source: 'task',
        taskId: task.id,
        taskContentSnapshot: task.content
      })
      await settingsStore.setPomodoroActiveSession(session)
      now.value = Date.now()
      startTicking()
      runtime.toast.show(`已为“${task.content}”开始番茄钟。`, 'success')
      return true
    } finally {
      isBusy.value = false
    }
  }

  function getTaskPomodoroCount(taskId: number) {
    return taskPomodoroCountMap.value[taskId] ?? 0
  }

  return {
    initialized,
    isBusy,
    isRunning,
    activeSession,
    activeTaskLabel,
    history,
    focusDurationSeconds,
    focusDurationLabel,
    totalCompletedCount,
    todayCompletedCount,
    weekCompletedCount,
    taskCompletedCount,
    taskPomodoroCountMap,
    remainingSeconds,
    formattedRemaining,
    progressRatio,
    hydrate,
    start,
    startForTask,
    getTaskPomodoroCount,
    cancel
  }
})
