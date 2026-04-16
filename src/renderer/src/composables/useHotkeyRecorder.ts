import { ref, type Ref } from 'vue'
import {
  HOTKEY_LABELS,
  keyToLabel,
  type HotkeyAction,
  type HotkeyConfig
} from './useHotkeys'

interface UseHotkeyRecorderOptions {
  hotkeyConfig: HotkeyConfig
  isEnabled: Ref<boolean>
  updateBinding: (action: HotkeyAction, key: string) => void
  isGlobalHotkeyAction: (action: HotkeyAction) => boolean
  hasAtLeastTwoKeys: (key: string) => boolean
  reservedCategoryShortcutPattern: RegExp
}

export function useHotkeyRecorder(options: UseHotkeyRecorderOptions) {
  const recordingAction = ref<HotkeyAction | null>(null)
  const conflictMessage = ref('')

  function startRecording(action: HotkeyAction) {
    recordingAction.value = action
    conflictMessage.value = ''
    options.isEnabled.value = false
  }

  function cancelRecording() {
    recordingAction.value = null
    conflictMessage.value = ''
    options.isEnabled.value = true
  }

  function handleRecordKeydown(event: KeyboardEvent) {
    if (!recordingAction.value) return

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelRecording()
      return
    }

    if (['Control', 'Shift', 'Meta', 'Alt'].includes(event.key)) return

    event.preventDefault()
    event.stopPropagation()

    const parts: string[] = []
    if (event.ctrlKey || event.metaKey) parts.push('Control')
    if (event.shiftKey) parts.push('Shift')
    if (event.altKey) parts.push('Alt')

    let key = event.key
    if (key === ' ') key = 'Space'
    parts.push(key)

    const newKey = parts.join('+')

    if (options.reservedCategoryShortcutPattern.test(newKey)) {
      conflictMessage.value = 'Ctrl+数字键为切换分类的系统快捷键，无法绑定'
      return
    }

    if (
      options.isGlobalHotkeyAction(recordingAction.value) &&
      !options.hasAtLeastTwoKeys(newKey)
    ) {
      conflictMessage.value = '全局快捷键至少要包含两个键，请至少加一个修饰键'
      return
    }

    for (const [action, binding] of Object.entries(options.hotkeyConfig) as [
      HotkeyAction,
      { key: string; label: string }
    ][]) {
      if (action !== recordingAction.value && binding.key === newKey) {
        conflictMessage.value = `"${keyToLabel(newKey)}" 已被“${HOTKEY_LABELS[action].name}”占用`
        return
      }
    }

    conflictMessage.value = ''
    options.updateBinding(recordingAction.value, newKey)
    cancelRecording()
  }

  return {
    recordingAction,
    conflictMessage,
    startRecording,
    cancelRecording,
    handleRecordKeydown
  }
}
