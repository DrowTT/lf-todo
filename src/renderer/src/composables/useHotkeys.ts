import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useHoverTarget } from './useHoverTarget'
import { useConfirm } from './useConfirm'
import { store } from '../store'

// ─── 类型定义 ──────────────────────────────────────────────────
/** 单个快捷键动作标识 */
export type HotkeyAction = 'toggleComplete' | 'quickDelete' | 'toggleExpand' | 'focusInput'

/** 快捷键绑定的配置项 */
export interface HotkeyBinding {
  /** 按键标识（如 'Space', 'Delete', 'e', 'Control+n'） */
  key: string
  /** 显示标签 */
  label: string
}

/** 所有可配置快捷键的配置对象 */
export type HotkeyConfig = Record<HotkeyAction, HotkeyBinding>

// ─── 默认快捷键配置 ────────────────────────────────────────────
export const DEFAULT_HOTKEYS: HotkeyConfig = {
  toggleComplete: { key: 'Space', label: '空格' },
  quickDelete: { key: 'Delete', label: 'Delete' },
  toggleExpand: { key: 'e', label: 'E' },
  focusInput: { key: 'Control+n', label: 'Ctrl+N' }
}

/** 快捷键描述映射 */
export const HOTKEY_LABELS: Record<HotkeyAction, { name: string; desc: string }> = {
  toggleComplete: { name: '切换完成状态', desc: '切换鼠标悬停待办的完成/未完成' },
  quickDelete: { name: '快捷删除', desc: '删除鼠标悬停的待办（需确认）' },
  toggleExpand: { name: '展开/收起', desc: '展开或收起鼠标指向的一级待办' },
  focusInput: { name: '聚焦输入框', desc: '聚焦到新增待办或子待办输入框' }
}

const STORAGE_KEY = 'lf-todo-hotkeys'

// ─── 工具函数 ──────────────────────────────────────────────────

/** 从 localStorage 加载配置 */
function loadConfig(): HotkeyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HotkeyConfig>
      const config = { ...DEFAULT_HOTKEYS, ...parsed }

      // 迁移：如果旧配置绑定了单独的修饰键（如 Alt），替换为新默认值
      const forbiddenSoloKeys = ['Alt', 'Control', 'Shift', 'Meta']
      for (const [action, binding] of Object.entries(config) as [HotkeyAction, HotkeyBinding][]) {
        if (forbiddenSoloKeys.includes(binding.key)) {
          config[action] = { ...DEFAULT_HOTKEYS[action] }
        }
      }

      return config
    }
  } catch {
    // 解析失败时使用默认配置
  }
  return { ...DEFAULT_HOTKEYS }
}

/** 保存配置到 localStorage */
function saveConfig(config: HotkeyConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/**
 * 将 KeyboardEvent 标准化为可比对的按键字符串
 * 例如：'Control+n', 'Space', 'Delete'
 *
 * 注意：单独的修饰键（Alt/Control/Shift/Meta）会返回空字符串，
 * 由调用方过滤，避免与系统快捷键冲突导致误触。
 */
function normalizeKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Control')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey && e.key !== 'Alt') parts.push('Alt')

  // 标准化 key 名称
  let key = e.key
  if (key === ' ') key = 'Space'

  // 排除所有修饰键（包括 Alt），防止单独按修饰键触发快捷键
  if (!['Control', 'Shift', 'Meta', 'Alt'].includes(key)) {
    parts.push(key)
  }

  return parts.join('+')
}

/**
 * 将按键字符串转为用户可读标签
 */
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

/**
 * 判断是否为需要忽略快捷键的输入元素
 */
function isInputElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  )
}

/**
 * 判断确认弹窗是否正在显示
 */
function isConfirmDialogVisible(): boolean {
  return !!document.querySelector('.dialog-wrapper')
}

// ─── 全局单例状态 ──────────────────────────────────────────────
const hotkeyConfig = reactive<HotkeyConfig>(loadConfig())
const isEnabled = ref(true)

/**
 * 标记全局事件监听器是否已注册。
 *
 * 关键设计：useHotkeys() 会在 App.vue 和 SettingsPanel.vue 中各调用一次，
 * 但 keydown/keyup 事件监听器只需注册**一次**。如果注册多次，
 * 同一按键会触发多个 handler，导致双重 toggle 互相抵消。
 */
let listenerRegistered = false

// ─── 全局事件 handler（模块级，确保只有一个实例） ─────────────────

/** 匹配快捷键并返回对应 action */
function matchAction(normalizedKey: string): HotkeyAction | null {
  for (const [action, binding] of Object.entries(hotkeyConfig) as [HotkeyAction, HotkeyBinding][]) {
    if (binding.key === normalizedKey) return action
  }
  return null
}

/**
 * 快捷键系统 composable
 *
 * 在 App.vue 中调用一次以初始化全局监听（仅首次注册事件），
 * 在 SettingsPanel 中调用获取配置进行展示和修改。
 */
export function useHotkeys() {
  const { hoveredTarget, hoveredParentTaskId } = useHoverTarget()
  const { confirm } = useConfirm()

  /** 执行快捷键对应的操作 */
  async function executeAction(action: HotkeyAction) {
    switch (action) {
      case 'toggleComplete': {
        // 快照 hover 状态，避免异步操作中状态丢失
        const taskId = hoveredTarget.taskId
        const type = hoveredTarget.type
        const parentId = hoveredTarget.parentId
        if (!taskId) return
        if (type === 'task') {
          await store.toggleTask(taskId)
        } else if (type === 'subtask' && parentId) {
          await store.toggleSubTask(taskId, parentId)
        }
        break
      }
      case 'quickDelete': {
        // 先快照 hover 信息，再 await confirm
        // 避免用户移动鼠标到弹窗按钮时 hover 状态丢失
        const taskId = hoveredTarget.taskId
        const type = hoveredTarget.type
        const parentId = hoveredTarget.parentId
        if (!taskId) return
        if (type === 'task') {
          const ok = await confirm('确认删除该任务吗？')
          if (ok) await store.deleteTask(taskId)
        } else if (type === 'subtask' && parentId) {
          const ok = await confirm('确认删除该子任务吗？')
          if (ok) await store.deleteSubTask(taskId, parentId)
        }
        break
      }
      case 'toggleExpand': {
        // 只操作一级待办
        const parentId = hoveredParentTaskId.value
        if (parentId) {
          await store.toggleExpand(parentId)
        }
        break
      }
      case 'focusInput': {
        const parentId = hoveredParentTaskId.value
        if (parentId) {
          // 如果悬停的一级待办未展开，先展开它
          if (!store.expandedTaskIds.has(parentId)) {
            await store.toggleExpand(parentId)
          }
          // 等待 DOM 更新后聚焦子任务输入框
          await nextTick()
          const subInput = document.querySelector(
            `[data-task-id="${parentId}"] .sub-add__input`
          ) as HTMLTextAreaElement | null
          if (subInput) {
            subInput.focus()
            return
          }
        }
        // 鼠标不在任何待办上时聚焦到主输入框
        const mainInput = document.querySelector('.todo-input__field') as HTMLTextAreaElement | null
        mainInput?.focus()
        break
      }
    }
  }

  /** 处理 Ctrl+数字键 切换分类 */
  function handleCategorySwitch(e: KeyboardEvent): boolean {
    if (!(e.ctrlKey || e.metaKey)) return false
    const num = parseInt(e.key, 10)
    if (isNaN(num) || num < 1 || num > 9) return false

    const categories = store.categories
    const index = num - 1
    if (index < categories.length) {
      // 已经是当前分类则跳过
      if (categories[index].id === store.currentCategoryId) return true
      e.preventDefault()
      store.selectCategory(categories[index].id)
      return true
    }
    return false
  }

  /** 全局 keydown 处理 */
  function handleKeydown(e: KeyboardEvent) {
    // 快捷键系统被禁用时跳过（如设置面板录键中）
    if (!isEnabled.value) return

    // 确认弹窗显示时，不拦截任何按键
    if (isConfirmDialogVisible()) return

    // 先处理 Ctrl+数字键（不可配置）
    if (handleCategorySwitch(e)) return

    // 焦点在输入元素中时不处理快捷键
    if (isInputElement(e.target)) return

    // 标准化按键
    const normalizedKey = normalizeKeyEvent(e)

    // 空的标准化结果说明是单独的修饰键，跳过
    if (!normalizedKey) return

    // 匹配动作
    const action = matchAction(normalizedKey)
    if (!action) return

    // 阻止默认行为
    e.preventDefault()
    e.stopPropagation()

    // 如果焦点在按钮上（如 checkbox），立即 blur 防止 keyup 触发 click
    const activeElement = document.activeElement as HTMLElement | null
    if (activeElement && activeElement.tagName === 'BUTTON') {
      activeElement.blur()
    }

    executeAction(action)
  }

  /**
   * 全局 keyup 处理：拦截空格键等的 keyup 事件，
   * 防止浏览器的 keyup→click 链触发 button 点击导致双重 toggle
   */
  function handleKeyup(e: KeyboardEvent) {
    if (!isEnabled.value) return
    if (isConfirmDialogVisible()) return
    if (isInputElement(e.target)) return

    const normalizedKey = normalizeKeyEvent(e)
    if (!normalizedKey) return

    // 如果这个 keyup 对应的按键绑定了快捷键 action，也拦截
    const action = matchAction(normalizedKey)
    if (action) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // ─── 事件监听器注册（仅首次调用时注册） ──────────────────────
  if (!listenerRegistered) {
    // 使用 onMounted 确保在 Vue 生命周期内注册
    onMounted(() => {
      // 再次检查以防并发
      if (!listenerRegistered) {
        window.addEventListener('keydown', handleKeydown, true)
        window.addEventListener('keyup', handleKeyup, true)
        listenerRegistered = true
      }
    })
  }

  /** 更新某个 action 的快捷键绑定 */
  function updateBinding(action: HotkeyAction, key: string) {
    hotkeyConfig[action] = {
      key,
      label: keyToLabel(key)
    }
    saveConfig({ ...hotkeyConfig })
  }

  /** 重置某个 action 为默认值 */
  function resetBinding(action: HotkeyAction) {
    hotkeyConfig[action] = { ...DEFAULT_HOTKEYS[action] }
    saveConfig({ ...hotkeyConfig })
  }

  /** 重置所有快捷键为默认值 */
  function resetAllBindings() {
    for (const action of Object.keys(DEFAULT_HOTKEYS) as HotkeyAction[]) {
      hotkeyConfig[action] = { ...DEFAULT_HOTKEYS[action] }
    }
    saveConfig({ ...hotkeyConfig })
  }

  return {
    hotkeyConfig,
    isEnabled,
    updateBinding,
    resetBinding,
    resetAllBindings
  }
}
