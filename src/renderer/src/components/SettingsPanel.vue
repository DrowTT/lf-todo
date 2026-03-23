<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Settings, X, Power, MonitorOff, Trash2, Download, Info } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// 检查是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.api !== undefined

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

// ─── 加载设置 ───────────────────────────────────────────────────────
const loadSettings = async () => {
  if (!isElectron) return
  const settings = await window.api.settings.getAll()
  autoLaunch.value = settings.autoLaunch
  closeToTray.value = settings.closeToTray
  autoCleanupEnabled.value = settings.autoCleanup.enabled
  autoCleanupDays.value = settings.autoCleanup.days

  const info = await window.api.settings.getAppInfo()
  appInfo.value = info
}

// 面板首次挂载和每次打开时重新加载设置
onMounted(loadSettings)
watch(() => props.visible, (val) => {
  if (val) loadSettings()
})

// ─── 设置变更处理（即时生效） ─────────────────────────────────────────
const handleAutoLaunchChange = async () => {
  if (!isElectron) return
  await window.api.settings.setAutoLaunch(autoLaunch.value)
}

const handleCloseToTrayChange = async () => {
  if (!isElectron) return
  await window.api.settings.setCloseToTray(closeToTray.value)
}

const handleAutoCleanupChange = async () => {
  if (!isElectron) return
  await window.api.settings.setAutoCleanup({
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
    await window.api.settings.exportData()
  } finally {
    isExporting.value = false
  }
}

// ─── ESC 键关闭 ─────────────────────────────────────────────────────
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Transition name="settings-overlay">
    <div v-if="visible" class="settings-overlay" @click.self="emit('close')" @keydown="handleKeydown" tabindex="-1" ref="overlayRef">
      <Transition name="settings-panel">
        <div v-if="visible" class="settings-panel">
          <!-- 头部 -->
          <div class="settings-panel__header">
            <div class="settings-panel__header-left">
              <Settings :size="18" class="settings-panel__header-icon" />
              <h2 class="settings-panel__title">设置</h2>
            </div>
            <button class="settings-panel__close" title="关闭" @click="emit('close')">
              <X :size="16" />
            </button>
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
                    type="checkbox"
                    v-model="autoLaunch"
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
                    type="checkbox"
                    v-model="closeToTray"
                    @change="handleCloseToTrayChange"
                  />
                  <span class="toggle-switch__slider"></span>
                </label>
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
                    type="checkbox"
                    v-model="autoCleanupEnabled"
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
  display: flex;
  justify-content: flex-end;
}

// ─── 面板主体 ──────────────────────────────────────────────────────
.settings-panel {
  width: 380px;
  max-width: 90vw;
  height: 100%;
  background: $bg-primary;
  border-left: 1px solid $border-color;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;

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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: $radius-sm;
    color: $text-muted;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
      color: $text-primary;
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
