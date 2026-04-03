import { nextTick, onMounted, reactive, ref } from 'vue'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { useAppSessionStore } from '../store/appSession'
import { useHoverTarget } from './useHoverTarget'

export type LocalHotkeyAction = 'toggleComplete' | 'quickDelete' | 'toggleExpand' | 'focusInput'
export type GlobalHotkeyAction = 'showWindow' | 'showWindowAndFocusInput'
export type HotkeyAction = LocalHotkeyAction | GlobalHotkeyAction

export interface HotkeyBinding {
  key: string
  label: string
}

export type HotkeyConfig = Record<HotkeyAction, HotkeyBinding>
export type GlobalHotkeyConfig = Record<GlobalHotkeyAction, HotkeyBinding>

export const GLOBAL_HOTKEY_ACTIONS: GlobalHotkeyAction[] = [
  'showWindow',
  'showWindowAndFocusInput'
]

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  toggleComplete: { key: 'Space', label: '空格' },
  quickDelete: { key: 'Delete', label: 'Delete' },
  toggleExpand: { key: 'e', label: 'E' },
  focusInput: { key: 'Control+n', label: 'Ctrl+N' },
  showWindow: { key: 'Control+Alt+l', label: 'Ctrl+Alt+L' },
  showWindowAndFocusInput: { key: 'Control+Alt+n', label: 'Ctrl+Alt+N' }
}

export const HOTKEY_LABELS: Record<HotkeyAction, { name: string; desc: string }> = {
  toggleComplete: { name: '切换完成状态', desc: '切换鼠标悬停待办的完成/未完成状态' },
  quickDelete: { name: '快捷删除', desc: '删除鼠标悬停的待办，需要二次确认' },
  toggleExpand: { name: '展开/收起', desc: '展开或收起鼠标指向的一级待办' },
  focusInput: { name: '聚焦输入框', desc: '聚焦到新增待办或子待办输入框' },
  showWindow: { name: '唤起窗口', desc: '全局唤起窗口，并临时显示到最上层' },
  showWindowAndFocusInput: {
    name: '唤起并聚焦主输入框',
    desc: '全局唤起窗口，并聚焦到主代办创建输入框'
  }
}

const STORAGE_KEY = 'lf-todo-hotkeys'
const MODIFIER_KEYS = ['Alt', 'Control', 'Shift', 'Meta']
const RESERVED_CATEGORY_SHORTCUT = /^Control\+[1-9]$/

const hotkeyConfig = reactive<HotkeyConfig>(loadConfig())
const isEnabled = ref(true)

let keyboardListenersRegistered = false
let mainInputListenerRegistered = false

function isGlobalHotkeyAction(action: HotkeyAction): action is GlobalHotkeyAction {
  return GLOBAL_HOTKEY_ACTIONS.includes(action as GlobalHotkeyAction)
}

function loadConfig(): HotkeyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_HOTKEYS }

    const parsed = JSON.parse(raw) as Partial<HotkeyConfig>
    const config = { ...DEFAULT_HOTKEYS, ...parsed }

    for (const action of Object.keys(config) as HotkeyAction[]) {
      const binding = config[action]
      if (!binding?.key || MODIFIER_KEYS.includes(binding.key)) {
        config[action] = { ...DEFAULT_HOTKEYS[action] }
        continue
      }

      if (isGlobalHotkeyAction(action) && !hasAtLeastTwoKeys(binding.key)) {
        config[action] = { ...DEFAULT_HOTKEYS[action] }
      }
    }

    return config
  } catch {
    return { ...DEFAULT_HOTKEYS }
  }
}

function saveConfig(config: HotkeyConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function hasAtLeastTwoKeys(key: string): boolean {
  return key
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean).length >= 2
}

function extractGlobalHotkeyConfig(config: HotkeyConfig): GlobalHotkeyConfig {
  return {
    showWindow: {
      key: config.showWindow.key,
      label: config.showWindow.label
    },
    showWindowAndFocusInput: {
      key: config.showWindowAndFocusInput.key,
      label: config.showWindowAndFocusInput.label
    }
  }
}

function syncGlobalHotkeysToMain(): void {
  window.api?.settings
    ?.setGlobalHotkeys(extractGlobalHotkeyConfig(hotkeyConfig))
    .catch((error) => console.error('[hotkeys] sync global hotkeys failed', error))
}

function normalizeKeyEvent(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('Control')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey && event.key !== 'Alt') parts.push('Alt')

  let key = event.key
  if (key === ' ') key = 'Space'

  if (!MODIFIER_KEYS.includes(key)) {
    parts.push(key)
  }

  return parts.join('+')
}

export function keyToLabel(key: string): string {
  const map: Record<string, string> = {
    Space: '空格',
    Delete: 'Delete',
    Backspace: 'Backspace',
    Alt: 'Alt',
    Control: 'Ctrl',
    Shift: 'Shift',
    Enter: 'Enter',
    Escape: 'Esc',
    Tab: 'Tab',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→'
  }

  return key
    .split('+')
    .map((part) => map[part] || part.toUpperCase())
    .join('+')
}

function isInputElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function isConfirmDialogVisible(): boolean {
  return !!document.querySelector('.dialog-wrapper')
}

function focusMainInputField(): void {
  const mainInput = document.querySelector('.todo-input__field') as HTMLTextAreaElement | null
  mainInput?.focus()
}

function matchAction(normalizedKey: string): HotkeyAction | null {
  for (const [action, binding] of Object.entries(hotkeyConfig) as [HotkeyAction, HotkeyBinding][]) {
    if (binding.key === normalizedKey) return action
  }
  return null
}

export function useHotkeys() {
  const app = useAppFacade()
  const appSessionStore = useAppSessionStore()
  const { hoveredTarget, hoveredParentTaskId } = useHoverTarget()
  const { confirm } = useAppRuntime().confirm

  async function executeAction(action: HotkeyAction) {
    switch (action) {
      case 'toggleComplete': {
        const taskId = hoveredTarget.taskId
        const type = hoveredTarget.type
        const parentId = hoveredTarget.parentId
        if (!taskId) return

        if (type === 'task') {
          await app.toggleTask(taskId)
        } else if (type === 'subtask' && parentId) {
          await app.toggleSubTask(taskId, parentId)
        }
        break
      }
      case 'quickDelete': {
        const taskId = hoveredTarget.taskId
        const type = hoveredTarget.type
        const parentId = hoveredTarget.parentId
        if (!taskId) return

        if (type === 'task') {
          const ok = await confirm('确认删除该任务吗？')
          if (ok) await app.deleteTask(taskId)
        } else if (type === 'subtask' && parentId) {
          const ok = await confirm('确认删除该子任务吗？')
          if (ok) await app.deleteSubTask(taskId, parentId)
        }
        break
      }
      case 'toggleExpand': {
        const parentId = hoveredParentTaskId.value
        if (parentId) {
          await app.toggleExpand(parentId)
        }
        break
      }
      case 'focusInput': {
        const parentId = hoveredParentTaskId.value
        if (parentId) {
          if (!app.expandedTaskIds.value.has(parentId)) {
            await app.toggleExpand(parentId)
          }

          await nextTick()
          const subInput = document.querySelector(
            `[data-task-id="${parentId}"] .sub-add__input`
          ) as HTMLTextAreaElement | null

          if (subInput) {
            subInput.focus()
            return
          }
        }

        focusMainInputField()
        break
      }
      case 'showWindow':
      case 'showWindowAndFocusInput':
        break
    }
  }

  function handleCategorySwitch(event: KeyboardEvent): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false

    const num = parseInt(event.key, 10)
    if (Number.isNaN(num) || num < 1 || num > 9) return false

    const categories = app.categories.value
    const index = num - 1
    if (index >= categories.length) return false

    event.preventDefault()
    event.stopPropagation()
    appSessionStore.setCurrentMainView('tasks')

    if (categories[index].id === app.currentCategoryId.value) return true

    void app.selectCategory(categories[index].id)
    return true
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isEnabled.value) return
    if (isConfirmDialogVisible()) return
    if (handleCategorySwitch(event)) return
    if (isInputElement(event.target)) return

    const normalizedKey = normalizeKeyEvent(event)
    if (!normalizedKey) return

    const action = matchAction(normalizedKey)
    if (!action || isGlobalHotkeyAction(action)) return

    event.preventDefault()
    event.stopPropagation()

    const activeElement = document.activeElement as HTMLElement | null
    if (activeElement && activeElement.tagName === 'BUTTON') {
      activeElement.blur()
    }

    void executeAction(action)
  }

  function handleKeyup(event: KeyboardEvent) {
    if (!isEnabled.value) return
    if (isConfirmDialogVisible()) return
    if (isInputElement(event.target)) return

    const normalizedKey = normalizeKeyEvent(event)
    if (!normalizedKey) return

    const action = matchAction(normalizedKey)
    if (action && !isGlobalHotkeyAction(action)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  if (!keyboardListenersRegistered) {
    onMounted(() => {
      if (keyboardListenersRegistered) return

      window.addEventListener('keydown', handleKeydown, true)
      window.addEventListener('keyup', handleKeyup, true)
      keyboardListenersRegistered = true
      syncGlobalHotkeysToMain()
    })
  }

  if (!mainInputListenerRegistered) {
    onMounted(() => {
      if (mainInputListenerRegistered || !window.api?.window?.onFocusMainInputRequested) return

      window.api.window.onFocusMainInputRequested(() => {
        requestAnimationFrame(() => {
          focusMainInputField()
        })
      })

      mainInputListenerRegistered = true
    })
  }

  function updateBinding(action: HotkeyAction, key: string) {
    hotkeyConfig[action] = {
      key,
      label: keyToLabel(key)
    }

    saveConfig({ ...hotkeyConfig })

    if (isGlobalHotkeyAction(action)) {
      syncGlobalHotkeysToMain()
    }
  }

  function resetBinding(action: HotkeyAction) {
    hotkeyConfig[action] = { ...DEFAULT_HOTKEYS[action] }
    saveConfig({ ...hotkeyConfig })

    if (isGlobalHotkeyAction(action)) {
      syncGlobalHotkeysToMain()
    }
  }

  function resetAllBindings() {
    for (const action of Object.keys(DEFAULT_HOTKEYS) as HotkeyAction[]) {
      hotkeyConfig[action] = { ...DEFAULT_HOTKEYS[action] }
    }

    saveConfig({ ...hotkeyConfig })
    syncGlobalHotkeysToMain()
  }

  return {
    hotkeyConfig,
    isEnabled,
    updateBinding,
    resetBinding,
    resetAllBindings,
    isGlobalHotkeyAction,
    hasAtLeastTwoKeys,
    reservedCategoryShortcutPattern: RESERVED_CATEGORY_SHORTCUT
  }
}
