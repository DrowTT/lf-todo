import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAppRuntime } from '../app/runtime'

interface UndoEntry {
  id: number
  label: string
  text: string
  expiresAt: number
  undo: () => Promise<boolean | void> | boolean | void
}

export const useUndoStore = defineStore('undo', () => {
  const runtime = useAppRuntime()
  const current = ref<UndoEntry | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  let sequence = 0

  const hasUndo = computed(() => Boolean(current.value))

  function clear() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    current.value = null
  }

  function register(options: {
    label: string
    text: string
    timeoutMs?: number
    undo: UndoEntry['undo']
  }) {
    clear()

    const timeoutMs = options.timeoutMs ?? 8000
    const entry: UndoEntry = {
      id: ++sequence,
      label: options.label,
      text: options.text,
      expiresAt: Date.now() + timeoutMs,
      undo: options.undo
    }

    current.value = entry
    runtime.toast.show(options.text, 'info', {
      duration: timeoutMs,
      actionLabel: options.label,
      onAction: () => void runUndo(entry.id)
    })

    timer = setTimeout(() => {
      if (current.value?.id === entry.id) {
        current.value = null
      }
      timer = null
    }, timeoutMs)
  }

  async function runUndo(entryId = current.value?.id) {
    const entry = current.value
    if (!entry || entry.id !== entryId) return false

    clear()

    try {
      const result = await entry.undo()
      runtime.toast.show('已撤销刚才的操作', 'success')
      return result !== false
    } catch (error) {
      console.error('[undoStore] undo failed', error)
      runtime.toast.show('撤销失败，请重试')
      return false
    }
  }

  return {
    current,
    hasUndo,
    register,
    clear,
    runUndo
  }
})
