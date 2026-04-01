<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  Settings,
  X,
  Power,
  MonitorOff,
  Trash2,
  Download,
  Info,
  Keyboard,
  RefreshCw
} from 'lucide-vue-next'
import { useAppRuntime } from '../app/runtime'
import { useHotkeys, HOTKEY_LABELS, keyToLabel, type HotkeyAction } from '../composables/useHotkeys'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// 检查是否在 Electron 环境中
const runtime = useAppRuntime()
const settingsRepository = runtime.repositories.settings
const updaterService = runtime.updater
const isElectron = settingsRepository.isAvailable
const stopUpdateListener = ref<(() => void) | null>(null)

// ─── 设置状态 ───────────────────────────────────────────────────────
const autoLaunch = ref(false)
const closeToTray = ref(true)
const autoCleanupEnabled = ref(false)
const autoCleanupDays = ref(7)
const isExporting = ref(false)

// 应用信息
const appInfo = ref({
  name: '极简待办',
  version: '0.0.0',
  electron: '',
  chrome: '',
  node: ''
})

// ─── 更新状态 ───────────────────────────────────────────────────────
type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

const updateStatus = ref<UpdateStatus>('idle')
const updateVersion = ref('')
const updatePercent = ref(0)
const updateError = ref('')

// 监听来自主进程的更新状态
const setupUpdateListener = () => {
  if (!isElectron) return
  stopUpdateListener.value?.()
  stopUpdateListener.value = updaterService.onUpdateStatus((data) => {
    updateStatus.value = data.status
    if (data.status === 'available') {
      updateVersion.value = data.version || ''
    } else if (data.status === 'downloading') {
      updatePercent.value = data.percent || 0
    } else if (data.status === 'downloaded') {
      updateVersion.value = data.version || ''
    } else if (data.status === 'error') {
      updateError.value = data.message || '未知错误'
    }
  })
}

const handleCheckUpdate = async () => {
  if (!isElectron) return
  updateStatus.value = 'checking'
  updateError.value = ''
  await updaterService.checkForUpdates()
}

const handleDownloadUpdate = async () => {
  if (!isElectron) return
  updatePercent.value = 0
  await updaterService.downloadUpdate()
}

const handleInstallUpdate = async () => {
  if (!isElectron) return
  await updaterService.installUpdate()
}

// ─── 快捷键设置 ──────────────────────────────────────────────────────
const { hotkeyConfig, isEnabled, updateBinding, resetAllBindings } = useHotkeys()
const { confirm } = runtime.confirm

/** 恢复默认：通过 useConfirm 弹出二次确认 */
const handleResetAll = async () => {
  const ok = await confirm('所有快捷键将恢复为初始设置，确认恢复默认吗？')
  if (ok) resetAllBindings()
}

// 当前正在录键的 action（null 表示未录键）
const recordingAction = ref<HotkeyAction | null>(null)
// 按键冲突提示信息
const conflictMessage = ref('')

/** 开始录键 */
const startRecording = (action: HotkeyAction) => {
  recordingAction.value = action
  conflictMessage.value = ''
  // 禁用快捷键系统，防止录键时触发操作
  isEnabled.value = false
}

/** 处理录键的 keydown */
const handleRecordKeydown = (e: KeyboardEvent) => {
  if (!recordingAction.value) return

  // Escape 取消录键
  if (e.key === 'Escape') {
    cancelRecording()
    return
  }

  // 忽略单独的修饰键按下（等待实际按键）—— 包括 Alt，防止误触
  if (['Control', 'Shift', 'Meta', 'Alt'].includes(e.key)) return

  e.preventDefault()
  e.stopPropagation()

  // 构建按键字符串
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Control')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  let key = e.key
  if (key === ' ') key = 'Space'
  parts.push(key)

  const newKey = parts.join('+')

  // 冲突检测：Ctrl+1~9 为系统保留快捷键
  if (/^Control\+[1-9]$/.test(newKey)) {
    conflictMessage.value = 'Ctrl+数字键为切换分类的系统快捷键，无法绑定'
    return
  }

  // 冲突检测：检查是否与其他 action 的绑定重复
  for (const [action, binding] of Object.entries(hotkeyConfig) as [
    HotkeyAction,
    { key: string; label: string }
  ][]) {
    if (action !== recordingAction.value && binding.key === newKey) {
      conflictMessage.value = `"${keyToLabel(newKey)}" 已被「${HOTKEY_LABELS[action].name}」占用`
      return
    }
  }

  conflictMessage.value = ''
  updateBinding(recordingAction.value, newKey)
  cancelRecording()
}

/** 取消录键 */
const cancelRecording = () => {
  recordingAction.value = null
  conflictMessage.value = ''
  isEnabled.value = true
}

// 面板关闭时取消录键
watch(
  () => props.visible,
  (val) => {
    if (!val && recordingAction.value) {
      cancelRecording()
    }
  }
)

// 所有可配置的快捷键 action 列表
const hotkeyActions: HotkeyAction[] = [
  'toggleComplete',
  'quickDelete',
  'toggleExpand',
  'focusInput'
]

// ─── 加载设置 ───────────────────────────────────────────────────────
const loadSettings = async () => {
  if (!isElectron) return
  const settings = await settingsRepository.getAll()
  autoLaunch.value = settings.autoLaunch
  closeToTray.value = settings.closeToTray
  autoCleanupEnabled.value = settings.autoCleanup.enabled
  autoCleanupDays.value = settings.autoCleanup.days

  const info = await settingsRepository.getAppInfo()
  appInfo.value = info
}

// 面板首次挂载和每次打开时重新加载设置
onMounted(() => {
  loadSettings()
  setupUpdateListener()
})
watch(
  () => props.visible,
  (val) => {
    if (val) loadSettings()
  }
)

// ─── 设置变更处理（即时生效） ─────────────────────────────────────────
const handleAutoLaunchChange = async () => {
  if (!isElectron) return
  await settingsRepository.setAutoLaunch(autoLaunch.value)
}

const handleCloseToTrayChange = async () => {
  if (!isElectron) return
  await settingsRepository.setCloseToTray(closeToTray.value)
}

const handleAutoCleanupChange = async () => {
  if (!isElectron) return
  await settingsRepository.setAutoCleanup({
    enabled: autoCleanupEnabled.value,
    days: autoCleanupDays.value
  })
}

// 天数变更时也同步保存
watch(autoCleanupDays, () => {
  if (autoCleanupEnabled.value) {
    handleAutoCleanupChange()
  }
})

const handleExportData = async () => {
  if (!isElectron || isExporting.value) return
  isExporting.value = true
  try {
    await settingsRepository.exportData()
  } finally {
    isExporting.value = false
  }
}

// ─── ESC 键关闭 ─────────────────────────────────────────────────────
const handleKeydown = (e: KeyboardEvent) => {
  // 录键模式下拦截所有键
  if (recordingAction.value) {
    handleRecordKeydown(e)
    return
  }
  if (e.key === 'Escape' && props.visible) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopUpdateListener.value?.()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <!-- 遮罩层：淡入淡出 -->
  <Transition name="settings-overlay">
    <div
      v-if="visible"
      ref="overlayRef"
      class="settings-overlay"
      tabindex="-1"
      @click.self="emit('close')"
      @keydown="handleKeydown"
    />
  </Transition>

  <!-- 面板：从右侧滑入 -->
  <Transition name="settings-panel">
    <div v-if="visible" class="settings-panel" tabindex="-1" @keydown="handleKeydown">
      <!-- 头部 -->
      <!-- 关闭按钮：绝对定位到右上角，与 TitleBar 关闭按钮完全重合 -->
      <button class="settings-panel__close" title="关闭" @click="emit('close')">
        <X :size="14" />
      </button>

      <div class="settings-panel__header">
        <div class="settings-panel__header-left">
          <Settings :size="18" class="settings-panel__header-icon" />
          <h2 class="settings-panel__title">设置</h2>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="settings-panel__body">
        <!-- 通用设置 -->
        <div class="settings-group">
          <div class="settings-group__header">
            <Power :size="14" class="settings-group__icon" />
            <span>通用</span>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label" for="auto-launch">开机自启</label>
              <span class="settings-item__desc">登录系统时自动启动极简待办</span>
            </div>
            <label class="toggle-switch" for="auto-launch">
              <input
                id="auto-launch"
                v-model="autoLaunch"
                type="checkbox"
                @change="handleAutoLaunchChange"
              />
              <span class="toggle-switch__slider"></span>
            </label>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label" for="close-to-tray">
                <MonitorOff :size="14" class="settings-item__inline-icon" />
                关闭时最小化到托盘
              </label>
              <span class="settings-item__desc">关闭后仍可通过托盘图标打开，关闭则直接退出</span>
            </div>
            <label class="toggle-switch" for="close-to-tray">
              <input
                id="close-to-tray"
                v-model="closeToTray"
                type="checkbox"
                @change="handleCloseToTrayChange"
              />
              <span class="toggle-switch__slider"></span>
            </label>
          </div>
        </div>

        <!-- 快捷键设置 -->
        <div class="settings-group">
          <div class="settings-group__header">
            <Keyboard :size="14" class="settings-group__icon" />
            <span>快捷键</span>
            <button class="hotkey-reset-all" @click="handleResetAll">恢复默认</button>
          </div>

          <!-- 可配置快捷键列表 -->
          <div
            v-for="action in hotkeyActions"
            :key="action"
            class="hotkey-row"
            :class="{ 'hotkey-row--active': recordingAction === action }"
          >
            <div class="hotkey-row__info">
              <span class="hotkey-row__name">{{ HOTKEY_LABELS[action].name }}</span>
              <!-- 冲突提示覆盖描述文字 -->
              <span
                v-if="recordingAction === action && conflictMessage"
                class="hotkey-row__conflict"
              >
                {{ conflictMessage }}
              </span>
              <span v-else class="hotkey-row__desc">{{ HOTKEY_LABELS[action].desc }}</span>
            </div>
            <div class="hotkey-row__actions">
              <!-- 录键状态 -->
              <span v-if="recordingAction === action" class="hotkey-key hotkey-key--recording">
                等待输入…
              </span>
              <!-- 正常状态：点击 badge 直接开始录键 -->
              <span
                v-else
                class="hotkey-key"
                title="点击修改快捷键"
                @click="startRecording(action)"
              >
                {{ hotkeyConfig[action].label }}
              </span>
              <!-- 录键中显示取消按钮 -->
              <button
                v-if="recordingAction === action"
                class="hotkey-action hotkey-action--cancel"
                @click="cancelRecording"
              >
                Esc 取消
              </button>
            </div>
          </div>

          <!-- 固定快捷键：Ctrl+数字切换分类 -->
          <div class="hotkey-row hotkey-row--fixed">
            <div class="hotkey-row__info">
              <span class="hotkey-row__name">切换分类</span>
              <span class="hotkey-row__desc">Ctrl+数字键快速切换到对应分类</span>
            </div>
            <div class="hotkey-row__actions">
              <span class="hotkey-key hotkey-key--fixed">Ctrl+1~9</span>
              <span class="hotkey-tag">系统</span>
            </div>
          </div>
        </div>

        <!-- 数据管理 -->
        <div class="settings-group">
          <div class="settings-group__header">
            <Trash2 :size="14" class="settings-group__icon" />
            <span>数据管理</span>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label" for="auto-cleanup">自动清理已完成任务</label>
              <span class="settings-item__desc">在每次启动时自动删除过期的已完成任务</span>
            </div>
            <label class="toggle-switch" for="auto-cleanup">
              <input
                id="auto-cleanup"
                v-model="autoCleanupEnabled"
                type="checkbox"
                @change="handleAutoCleanupChange"
              />
              <span class="toggle-switch__slider"></span>
            </label>
          </div>

          <Transition name="cleanup-detail">
            <div v-if="autoCleanupEnabled" class="settings-item settings-item--nested">
              <div class="settings-item__info">
                <label class="settings-item__label" for="cleanup-days">清理范围</label>
              </div>
              <div class="cleanup-days-selector">
                <span class="cleanup-days-selector__text">清理</span>
                <select
                  id="cleanup-days"
                  v-model.number="autoCleanupDays"
                  class="cleanup-days-selector__select"
                >
                  <option :value="3">3 天</option>
                  <option :value="7">7 天</option>
                  <option :value="14">14 天</option>
                  <option :value="30">30 天</option>
                </select>
                <span class="cleanup-days-selector__text">前的已完成任务</span>
              </div>
            </div>
          </Transition>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label">
                <Download :size="14" class="settings-item__inline-icon" />
                导出数据
              </label>
              <span class="settings-item__desc">将所有待办数据导出为 JSON 文件</span>
            </div>
            <button
              class="settings-item__action-btn"
              :disabled="isExporting"
              @click="handleExportData"
            >
              {{ isExporting ? '导出中...' : '导出' }}
            </button>
          </div>
        </div>

        <!-- 关于 -->
        <div class="settings-group">
          <div class="settings-group__header">
            <Info :size="14" class="settings-group__icon" />
            <span>关于</span>
          </div>

          <div class="settings-about">
            <div class="settings-about__app">
              <span class="settings-about__dot"></span>
              <span class="settings-about__name">{{ appInfo.name }}</span>
              <span class="settings-about__version">v{{ appInfo.version }}</span>
            </div>

            <!-- 更新区域 -->
            <div class="update-section">
              <!-- 闲置 / 已是最新 -->
              <div
                v-if="updateStatus === 'idle' || updateStatus === 'not-available'"
                class="update-section__row"
              >
                <span
                  v-if="updateStatus === 'not-available'"
                  class="update-section__text update-section__text--success"
                >
                  ✓ 已是最新版本
                </span>
                <button class="update-section__btn" @click="handleCheckUpdate">
                  <RefreshCw :size="12" />
                  检查更新
                </button>
              </div>

              <!-- 检查中 -->
              <div v-else-if="updateStatus === 'checking'" class="update-section__row">
                <span class="update-section__text update-section__text--checking">
                  <RefreshCw :size="12" class="update-section__spin" />
                  正在检查更新…
                </span>
              </div>

              <!-- 发现新版本 -->
              <div v-else-if="updateStatus === 'available'" class="update-section__row">
                <span class="update-section__text update-section__text--available">
                  🎉 发现新版本 v{{ updateVersion }}
                </span>
                <button
                  class="update-section__btn update-section__btn--primary"
                  @click="handleDownloadUpdate"
                >
                  <Download :size="12" />
                  下载更新
                </button>
              </div>

              <!-- 下载中 -->
              <div v-else-if="updateStatus === 'downloading'" class="update-section__column">
                <span class="update-section__text"> 正在下载更新… {{ updatePercent }}% </span>
                <div class="update-section__progress">
                  <div
                    class="update-section__progress-bar"
                    :style="{ width: updatePercent + '%' }"
                  />
                </div>
              </div>

              <!-- 下载完成 -->
              <div v-else-if="updateStatus === 'downloaded'" class="update-section__row">
                <span class="update-section__text update-section__text--success">
                  ✓ v{{ updateVersion }} 已下载完成
                </span>
                <button
                  class="update-section__btn update-section__btn--primary"
                  @click="handleInstallUpdate"
                >
                  立即安装
                </button>
              </div>

              <!-- 错误 -->
              <div v-else-if="updateStatus === 'error'" class="update-section__row">
                <span class="update-section__text update-section__text--error">
                  检查失败：{{ updateError }}
                </span>
                <button class="update-section__btn" @click="handleCheckUpdate">重试</button>
              </div>
            </div>

            <div class="settings-about__meta">
              <div class="settings-about__meta-row">
                <span class="settings-about__meta-label">Electron</span>
                <span class="settings-about__meta-value">{{ appInfo.electron }}</span>
              </div>
              <div class="settings-about__meta-row">
                <span class="settings-about__meta-label">Chrome</span>
                <span class="settings-about__meta-value">{{ appInfo.chrome }}</span>
              </div>
              <div class="settings-about__meta-row">
                <span class="settings-about__meta-label">Node.js</span>
                <span class="settings-about__meta-value">{{ appInfo.node }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

// ─── Overlay 遮罩 ──────────────────────────────────────────────────
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

// ─── 面板主体 ──────────────────────────────────────────────────────
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 201;
  width: 380px;
  max-width: 90vw;
  height: 100%;
  background: $bg-primary;
  border-left: 1px solid $border-color;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none; // 消除录键后浏览器默认焦点蓝线

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 $spacing-lg;
    background: $bg-sidebar;
    border-bottom: 1px solid $border-color;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__header-icon {
    color: $accent-color;
  }

  &__title {
    font-size: $font-md;
    font-weight: 700;
    color: $text-primary;
    margin: 0;
    letter-spacing: 0.5px;
  }

  &__close {
    // 绝对定位到面板右上角，与 TitleBar 关闭按钮重合
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 36px;
    background: transparent;
    border: none;
    border-radius: 0;
    color: $text-muted;
    cursor: pointer;
    transition: all $transition-fast;
    -webkit-app-region: no-drag;

    &:hover {
      background: $danger-color;
      color: white;
    }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-lg;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;

    // 自定义滚动条
    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: $border-color;
      border-radius: 2px;
    }
  }
}

// ─── 设置分组 ──────────────────────────────────────────────────────
.settings-group {
  background: $bg-elevated;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  overflow: hidden;
  flex-shrink: 0;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: $spacing-md $spacing-lg;
    font-size: $font-xs;
    font-weight: 600;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid $border-subtle;
  }

  &__icon {
    color: $accent-color;
    flex-shrink: 0;
  }
}

// ─── 设置项 ──────────────────────────────────────────────────────
.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid $border-subtle;
  transition: background-color $transition-fast;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.015);
  }

  &--nested {
    padding-left: $spacing-xl;
    background: rgba($accent-color, 0.02);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: $font-sm;
    font-weight: 500;
    color: $text-primary;
    cursor: default;
  }

  &__inline-icon {
    color: $text-muted;
    flex-shrink: 0;
  }

  &__desc {
    font-size: $font-xs;
    color: $text-muted;
    line-height: 1.4;
  }

  &__action-btn {
    padding: 4px 14px;
    background: $accent-soft;
    color: $accent-color;
    border: 1px solid rgba($accent-color, 0.15);
    border-radius: $radius-md;
    font-size: $font-xs;
    font-weight: 500;
    cursor: pointer;
    transition: all $transition-fast;
    white-space: nowrap;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: rgba($accent-color, 0.15);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

// ─── 快捷键行 ──────────────────────────────────────────────────
.hotkey-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px $spacing-lg;
  border-bottom: 1px solid $border-subtle;
  transition: background-color $transition-fast;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.012);
  }

  // 录键激活态
  &--active {
    background: rgba($accent-color, 0.03);
  }

  // 固定快捷键行
  &--fixed {
    opacity: 0.55;

    &:hover {
      background: transparent;
      opacity: 0.65;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: $font-sm;
    font-weight: 500;
    color: $text-primary;
  }

  &__desc {
    font-size: 10px;
    color: $text-muted;
    line-height: 1.3;
  }

  &__conflict {
    font-size: 10px;
    color: $danger-color;
    line-height: 1.3;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
}

// ─── 按键标签（核心交互元素）────────────────────────────────────
.hotkey-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 26px;
  padding: 0 10px;
  background: rgba(0, 0, 0, 0.04);
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: $text-secondary;
  font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;

  &:hover {
    background: rgba($accent-color, 0.1);
    color: $accent-color;
  }

  &:active {
    background: rgba($accent-color, 0.16);
  }

  // 录键状态：蓝色发光边框 + 等待动画
  &--recording {
    min-width: 72px;
    background: $accent-soft;
    border-color: $accent-color;
    border-bottom-width: 1px;
    color: $accent-color;
    cursor: default;
    box-shadow: 0 0 0 3px rgba($accent-color, 0.12);
    animation: key-glow 1.5s ease-in-out infinite;

    &:hover {
      transform: none;
    }
  }

  // 固定快捷键
  &--fixed {
    cursor: default;
    background: $bg-primary;
    border-bottom-width: 1px;
    box-shadow: none;

    &:hover {
      border-color: $border-light;
      color: $text-primary;
      box-shadow: none;
      transform: none;
    }
  }
}

@keyframes key-glow {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba($accent-color, 0.12);
  }
  50% {
    box-shadow: 0 0 0 4px rgba($accent-color, 0.2);
  }
}

// ─── 操作按钮 ──────────────────────────────────────────────────
.hotkey-action {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all $transition-fast;
  white-space: nowrap;

  // 取消按钮
  &--cancel {
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 500;
    color: $text-muted;
    border-radius: $radius-sm;

    &:hover {
      color: $danger-color;
      background: rgba($danger-color, 0.06);
    }
  }
}

// ─── 系统标签 ──────────────────────────────────────────────────
.hotkey-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: $text-muted;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 3px;
}

// ─── 恢复默认按钮（header 内联） ─────────────────────────────────
.hotkey-reset-all {
  margin-left: auto;
  padding: 3px 10px;
  background: transparent;
  border: 1px solid $border-subtle;
  border-radius: $radius-sm;
  font-size: 10px;
  font-weight: 500;
  color: $text-muted;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $text-secondary;
    border-color: $border-light;
    background: rgba(0, 0, 0, 0.02);
  }
}

// ─── Toggle 开关 ──────────────────────────────────────────────────
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  &__slider {
    position: absolute;
    inset: 0;
    background: $border-light;
    border-radius: 10px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      left: 2px;
      bottom: 2px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  input:checked + &__slider {
    background: $accent-color;

    &::before {
      transform: translateX(16px);
    }
  }

  input:focus-visible + &__slider {
    box-shadow: $shadow-glow;
  }
}

// ─── 清理天数选择器 ──────────────────────────────────────────────
.cleanup-days-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  &__text {
    font-size: $font-xs;
    color: $text-secondary;
    white-space: nowrap;
  }

  &__select {
    padding: 2px 6px;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-xs;
    border: 1px solid $border-light;
    border-radius: $radius-sm;
    outline: none;
    cursor: pointer;
    transition: border-color $transition-fast;

    &:focus {
      border-color: $accent-color;
      box-shadow: 0 0 0 2px $accent-soft;
    }
  }
}

// ─── 关于区域 ──────────────────────────────────────────────────────
.settings-about {
  padding: $spacing-md $spacing-lg;

  &__app {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-md;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $accent-color;
    box-shadow: 0 0 6px rgba($accent-color, 0.3);
    flex-shrink: 0;
  }

  &__name {
    font-size: $font-lg;
    font-weight: 700;
    color: $text-primary;
  }

  &__version {
    font-size: $font-xs;
    color: $text-muted;
    background: $accent-soft;
    padding: 1px 8px;
    border-radius: 8px;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
  }

  &__meta-label {
    font-size: $font-xs;
    color: $text-muted;
  }

  &__meta-value {
    font-size: $font-xs;
    color: $text-secondary;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
  }
}

// ─── 更新区域 ──────────────────────────────────────────────────────
.update-section {
  margin-bottom: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: rgba($accent-color, 0.03);
  border: 1px solid rgba($accent-color, 0.08);
  border-radius: $radius-md;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
  }

  &__column {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__text {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: $font-xs;
    color: $text-secondary;

    &--success {
      color: #22c55e;
    }

    &--checking {
      color: $accent-color;
    }

    &--available {
      color: $accent-color;
      font-weight: 500;
    }

    &--error {
      color: $danger-color;
      font-size: 10px;
    }
  }

  &__spin {
    animation: spin 1s linear infinite;
  }

  &__btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid $border-subtle;
    border-radius: $radius-sm;
    font-size: 11px;
    font-weight: 500;
    color: $text-secondary;
    cursor: pointer;
    transition: all $transition-fast;
    white-space: nowrap;
    flex-shrink: 0;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
      border-color: $border-light;
    }

    &--primary {
      background: $accent-color;
      border-color: $accent-color;
      color: white;

      &:hover {
        background: darken($accent-color, 8%);
      }
    }
  }

  &__progress {
    width: 100%;
    height: 4px;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  &__progress-bar {
    height: 100%;
    background: linear-gradient(90deg, $accent-color, lighten($accent-color, 10%));
    border-radius: 2px;
    transition: width 0.3s ease;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// ─── 过渡动画 ──────────────────────────────────────────────────────

// Overlay 淡入淡出
.settings-overlay-enter-active,
.settings-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.settings-overlay-enter-from,
.settings-overlay-leave-to {
  opacity: 0;
}

// 面板滑入滑出
.settings-panel-enter-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.settings-panel-leave-active {
  transition: transform 0.2s ease-in;
}
.settings-panel-enter-from,
.settings-panel-leave-to {
  transform: translateX(100%);
}

// 清理详情展开
.cleanup-detail-enter-active {
  transition: all 0.2s ease;
}
.cleanup-detail-leave-active {
  transition: all 0.15s ease-in;
}
.cleanup-detail-enter-from,
.cleanup-detail-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
