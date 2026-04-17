import { nextTick, onMounted, reactive, ref } from 'vue'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { useAppSessionStore } from '../store/appSession'
import { useGlobalSearchStore } from '../store/globalSearch'
import { useHoverTarget } from './useHoverTarget'

export type LocalHotkeyAction =
  | 'toggleComplete'
  | 'quickDelete'
  | 'toggleExpand'
  | 'focusInput'
  | 'focusSearch'
  | 'openGlobalSearch'
export type GlobalHotkeyAction = 'showWindow' | 'showWindowAndFocusInput'
export type HotkeyAction = LocalHotkeyAction | GlobalHotkeyAction

export interface HotkeyBinding {
  key: string
  label: string
}

export type HotkeyConfig = Record<HotkeyAction, HotkeyBinding>
export type GlobalHotkeyConfig = Record<GlobalHotkeyAction, HotkeyBinding>

export const GLOBAL_HOTKEY_ACTIONS: GlobalHotkeyAction[] = ['showWindow', 'showWindowAndFocusInput']

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  toggleComplete: { key: 'Space', label: '空格' },
  quickDelete: { key: 'Delete', label: 'Delete' },
  toggleExpand: { key: 'e', label: 'E' },
  focusInput: { key: 'Control+n', label: 'Ctrl+N' },
  focusSearch: { key: 'Control+f', label: 'Ctrl+F' },
  openGlobalSearch: { key: 'Control+p', label: 'Ctrl+P' },
  showWindow: { key: 'Control+Alt+l', label: 'Ctrl+Alt+L' },
  showWindowAndFocusInput: { key: 'Control+Alt+n', label: 'Ctrl+Alt+N' }
}

export const HOTKEY_LABELS: Record<HotkeyAction, { name: string; desc: string }> = {
  toggleComplete: { name: '切换完成状态', desc: '切换鼠标悬停待办的完成 / 未完成状态' },
  quickDelete: { name: '快捷删除', desc: '删除鼠标悬停的待办，需要二次确认' },
  toggleExpand: { name: '展开 / 收起', desc: '展开或收起鼠标指向的一级待办' },
  focusInput: { name: '聚焦输入框', desc: '聚焦到新增待办或子待办输入框' },
  focusSearch: { name: '当前视图搜索', desc: '打开当前列表的内联搜索框' },
  openGlobalSearch: { name: '全局搜索', desc: '打开全部任务范围的统一搜索面板' },
  showWindow: { name: '唤起窗口', desc: '全局唤起窗口，并临时显示到最上层' },
  showWindowAndFocusInput: {
    name: '唤起并聚焦主输入框',
    desc: '全局唤起窗口，并聚焦到主待办创建输入框'
  }
}

export const FOCUS_SEARCH_EVENT = 'lf-todo:focus-search'

const STORAGE_KEY = 'lf-todo-hotkeys'
const MODIFIER_KEYS = ['Alt', 'Control', 'Shift', 'Meta']
const RESERVED_CATEGORY_SHORTCUT = /^Control\+[1-9]$/
const SEARCH_ACTIONS: LocalHotkeyAction[] = ['focusSearch', 'openGlobalSearch']
const LEGACY_GLOBAL_SEARCH_KEY = 'Control+k'
const CURRENT_FOCUS_SEARCH_KEY = DEFAULT_HOTKEYS.focusSearch.key
const CURRENT_OPEN_GLOBAL_SEARCH_KEY = DEFAULT_HOTKEYS.openGlobalSearch.key

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
    let shouldPersist = migrateSearchHotkeys(config, parsed)

    for (const action of Object.keys(config) as HotkeyAction[]) {
      const binding = config[action]
      let nextBinding: HotkeyBinding

      if (!binding?.key || MODIFIER_KEYS.includes(binding.key)) {
        nextBinding = { ...DEFAULT_HOTKEYS[action] }
      } else if (isGlobalHotkeyAction(action) && !hasAtLeastTwoKeys(binding.key)) {
        nextBinding = { ...DEFAULT_HOTKEYS[action] }
      } else {
        nextBinding = {
          key: binding.key,
          label: keyToLabel(binding.key)
        }
      }

      if (
        nextBinding.key !== binding?.key ||
        nextBinding.label !== binding?.label
      ) {
        shouldPersist = true
      }

      config[action] = nextBinding
    }

    if (shouldPersist) {
      saveConfig(config)
    }

    return config
  } catch {
    return { ...DEFAULT_HOTKEYS }
  }
}

function migrateSearchHotkeys(
  config: HotkeyConfig,
  parsed: Partial<HotkeyConfig>
): boolean {
  const isUsingLegacyGlobalSearchKey =
    parsed.openGlobalSearch?.key === LEGACY_GLOBAL_SEARCH_KEY
  const isUsingCtrlFForGlobalSearch =
    parsed.openGlobalSearch?.key === CURRENT_FOCUS_SEARCH_KEY
  const isUsingLegacyFocusSearchKey =
    parsed.focusSearch?.key === LEGACY_GLOBAL_SEARCH_KEY
  const shouldNormalizeFocusSearch =
    isUsingLegacyFocusSearchKey || isUsingCtrlFForGlobalSearch
  const shouldNormalizeGlobalSearch =
    !parsed.openGlobalSearch?.key ||
    isUsingLegacyGlobalSearchKey ||
    isUsingCtrlFForGlobalSearch

  if (
    !shouldNormalizeFocusSearch &&
    !shouldNormalizeGlobalSearch
  ) {
    return false
  }

  let changed = false
  const focusSearchKeyOccupiedByOtherAction = isKeyOccupiedByOtherAction(
    config,
    CURRENT_FOCUS_SEARCH_KEY,
    SEARCH_ACTIONS
  )
  const globalSearchKeyOccupiedByOtherAction = isKeyOccupiedByOtherAction(
    config,
    CURRENT_OPEN_GLOBAL_SEARCH_KEY,
    SEARCH_ACTIONS
  )

  if (
    shouldNormalizeFocusSearch &&
    !focusSearchKeyOccupiedByOtherAction &&
    config.focusSearch.key !== CURRENT_FOCUS_SEARCH_KEY
  ) {
    config.focusSearch = { ...DEFAULT_HOTKEYS.focusSearch }
    changed = true
  }

  if (
    shouldNormalizeGlobalSearch &&
    !globalSearchKeyOccupiedByOtherAction &&
    config.openGlobalSearch.key !== CURRENT_OPEN_GLOBAL_SEARCH_KEY
  ) {
    config.openGlobalSearch = { ...DEFAULT_HOTKEYS.openGlobalSearch }
    changed = true
  }

  return changed
}

function saveConfig(config: HotkeyConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function isKeyOccupiedByOtherAction(
  config: HotkeyConfig,
  key: string,
  excludedActions: HotkeyAction[] = []
): boolean {
  return Object.entries(config).some(([action, binding]) => {
    if (excludedActions.includes(action as HotkeyAction)) {
      return false
    }

    return binding.key === key
  })
}

function hasAtLeastTwoKeys(key: string): boolean {
  return (
    key
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean).length >= 2
  )
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
    ?.setGlobalHotkeys(extractGlobalHotkeysToMainConfig())
    .catch((error) => console.error('[hotkeys] sync global hotkeys failed', error))
}

function extractGlobalHotkeysToMainConfig(): GlobalHotkeyConfig {
  return extractGlobalHotkeyConfig(hotkeyConfig)
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

function requestSearchFocus(): void {
  window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT))
}

function matchAction(normalizedKey: string): HotkeyAction | null {
  if (hotkeyConfig.focusSearch.key === normalizedKey) return 'focusSearch'
  if (hotkeyConfig.openGlobalSearch.key === normalizedKey) return 'openGlobalSearch'

  for (const [action, binding] of Object.entries(hotkeyConfig) as [HotkeyAction, HotkeyBinding][]) {
    if (binding.key === normalizedKey) return action
  }
  return null
}

export function useHotkeys() {
  const app = useAppFacade()
  const appSessionStore = useAppSessionStore()
  const globalSearchStore = useGlobalSearchStore()
  const { hoveredTarget, hoveredParentTaskId } = useHoverTarget()
  const { confirm } = useAppRuntime().confirm

  async function executeAction(action: HotkeyAction) {
    const isArchivePane =
      appSessionStore.currentMainView === 'tasks' && appSessionStore.taskPaneView === 'archive'

    switch (action) {
      case 'toggleComplete': {
        if (isArchivePane) return
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
        if (isArchivePane) return
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
        if (isArchivePane) return
        const parentId = hoveredParentTaskId.value
        if (parentId) {
          await app.toggleExpand(parentId)
        }
        break
      }
      case 'focusInput': {
        if (isArchivePane) return
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
      case 'focusSearch': {
        appSessionStore.setCurrentMainView('tasks')
        await nextTick()
        requestSearchFocus()
        break
      }
      case 'openGlobalSearch': {
        globalSearchStore.open({
          scope: 'all'
        })
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

    if (
      categories[index].id === app.currentCategoryId.value &&
      appSessionStore.taskPaneView === 'active'
    ) {
      return true
    }

    void app.selectCategory(categories[index].id)
    return true
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isEnabled.value) return
    if (isConfirmDialogVisible()) return
    if (globalSearchStore.isOpen) return

    const normalizedKey = normalizeKeyEvent(event)
    if (!normalizedKey) return

    const action = matchAction(normalizedKey)
    const triggeredFromInput = isInputElement(event.target)
    if (handleCategorySwitch(event)) return
    if (!action || isGlobalHotkeyAction(action)) return
    if (triggeredFromInput && action !== 'focusSearch' && action !== 'openGlobalSearch') return

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
    if (globalSearchStore.isOpen) return

    const normalizedKey = normalizeKeyEvent(event)
    if (!normalizedKey) return

    const action = matchAction(normalizedKey)
    if (!action || isGlobalHotkeyAction(action)) return
    if (
      isInputElement(event.target) &&
      action !== 'focusSearch' &&
      action !== 'openGlobalSearch'
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
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
