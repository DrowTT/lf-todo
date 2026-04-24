<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ChevronDown,
  Download,
  Info,
  Keyboard,
  MonitorOff,
  Power,
  RefreshCw,
  Settings,
  Trash2,
  Upload
} from 'lucide-vue-next'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { HOTKEY_LABELS, useHotkeys, type HotkeyAction } from '../composables/useHotkeys'
import { useHotkeyRecorder } from '../composables/useHotkeyRecorder'
import { useSettingsStore } from '../store/settings'
import { useUpdaterStore } from '../store/updater'
import { useAppSessionStore } from '../store/appSession'
import { useGlobalSearchStore } from '../store/globalSearch'

const runtime = useAppRuntime()
const app = useAppFacade()
const appSessionStore = useAppSessionStore()
const globalSearchStore = useGlobalSearchStore()
const { confirm } = runtime.confirm
const {
  hotkeyConfig,
  isEnabled,
  updateBinding,
  resetAllBindings,
  isGlobalHotkeyAction,
  hasAtLeastTwoKeys,
  reservedCategoryShortcutPattern
} = useHotkeys()
const settingsStore = useSettingsStore()
const updaterStore = useUpdaterStore()

const {
  settings,
  appInfo,
  isLoading,
  isImporting,
  isMergingImport,
  isExporting,
  isSavingAutoLaunch,
  isSavingCloseToTray,
  isSavingAutoCleanup,
  loadError
} = storeToRefs(settingsStore)
const {
  status: updateStatus,
  version: updateVersion,
  percent: updatePercent,
  error: updateError
} = storeToRefs(updaterStore)

const isElectron = settingsStore.isAvailable
const hotkeyActions: HotkeyAction[] = [
  'toggleComplete',
  'quickDelete',
  'toggleExpand',
  'focusInput',
  'focusSearch',
  'openGlobalSearch',
  'showWindow',
  'showWindowAndFocusInput'
]

const autoLaunch = computed({
  get: () => settings.value.autoLaunch,
  set: (value: boolean) => {
    settings.value = { ...settings.value, autoLaunch: value }
  }
})

const closeToTray = computed({
  get: () => settings.value.closeToTray,
  set: (value: boolean) => {
    settings.value = { ...settings.value, closeToTray: value }
  }
})

const autoCleanupEnabled = computed({
  get: () => settings.value.autoCleanup.enabled,
  set: (value: boolean) => {
    settings.value = {
      ...settings.value,
      autoCleanup: { ...settings.value.autoCleanup, enabled: value }
    }
  }
})

const autoCleanupDays = computed({
  get: () => settings.value.autoCleanup.days,
  set: (value: number) => {
    settings.value = {
      ...settings.value,
      autoCleanup: { ...settings.value.autoCleanup, days: value }
    }
  }
})

// ---- 自定义 Dropdown 状态 ----
interface DropdownOption {
  value: number
  label: string
}

const cleanupDaysOptions: DropdownOption[] = [
  { value: 3, label: '3 天' },
  { value: 7, label: '7 天' },
  { value: 14, label: '14 天' },
  { value: 30, label: '30 天' }
]

const cleanupDropdownOpen = ref(false)
const cleanupDropdownRef = ref<HTMLElement | null>(null)
const cleanupDropdownPanelRef = ref<HTMLElement | null>(null)

interface DropdownPosition {
  top: number
  left: number
  width: number
}

const cleanupDropdownPosition = ref<DropdownPosition | null>(null)

const cleanupDisplayLabel = computed(() => {
  const opt = cleanupDaysOptions.find((o) => o.value === autoCleanupDays.value)
  return opt?.label ?? `${autoCleanupDays.value} 天`
})

function selectCleanupDays(value: number) {
  autoCleanupDays.value = value
  cleanupDropdownOpen.value = false
}

function getDropdownPosition(container: HTMLElement | null): DropdownPosition | null {
  if (!container) return null

  const trigger = container.querySelector<HTMLElement>('.dropdown__trigger')
  if (!trigger) return null

  const rect = trigger.getBoundingClientRect()
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width
  }
}

function updateCleanupDropdownPosition() {
  cleanupDropdownPosition.value = getDropdownPosition(cleanupDropdownRef.value)
}

function syncOpenDropdownPositions() {
  if (cleanupDropdownOpen.value) updateCleanupDropdownPosition()
}

async function toggleCleanupDropdown() {
  cleanupDropdownOpen.value = !cleanupDropdownOpen.value

  if (cleanupDropdownOpen.value) {
    await nextTick()
    updateCleanupDropdownPosition()
  }
}

function handleDropdownOutsideClick(event: MouseEvent) {
  const target = event.target as Node
  if (
    cleanupDropdownOpen.value &&
    cleanupDropdownRef.value &&
    !cleanupDropdownRef.value.contains(target) &&
    !cleanupDropdownPanelRef.value?.contains(target)
  ) {
    cleanupDropdownOpen.value = false
  }
}

const settingsStatusText = computed(() => {
  if (isLoading.value || !loadError.value) return ''
  return loadError.value
})

const updaterStatusText = computed(() => {
  if (!isElectron) return '当前环境不支持桌面更新'
  if (updateError.value) return updateError.value
  if (updateStatus.value === 'checking') return '正在检查更新...'
  if (updateStatus.value === 'available') return `发现新版本 v${updateVersion.value}`
  if (updateStatus.value === 'downloading') return `正在下载更新... ${updatePercent.value}%`
  if (updateStatus.value === 'downloaded') return `新版本 v${updateVersion.value} 已下载完成`
  if (updateStatus.value === 'not-available') return '当前已是最新版本'
  return '可检查新版本'
})

const { recordingAction, conflictMessage, startRecording, cancelRecording, handleRecordKeydown } =
  useHotkeyRecorder({
    hotkeyConfig,
    isEnabled,
    updateBinding,
    isGlobalHotkeyAction,
    hasAtLeastTwoKeys,
    reservedCategoryShortcutPattern
  })

async function handleResetAll() {
  const ok = await confirm('所有快捷键将恢复为初始设置，确认恢复默认吗？')
  if (ok) resetAllBindings()
}

async function handleAutoLaunchChange() {
  if (!isElectron) return
  await settingsStore.setAutoLaunch(autoLaunch.value)
}

async function handleCloseToTrayChange() {
  if (!isElectron) return
  await settingsStore.setCloseToTray(closeToTray.value)
}

async function handleAutoCleanupChange() {
  if (!isElectron) return
  await settingsStore.setAutoCleanup({
    enabled: autoCleanupEnabled.value,
    days: autoCleanupDays.value
  })
}

async function handleExportData() {
  if (!isElectron || isExporting.value) return
  await settingsStore.exportData()
}

async function handleImportData() {
  if (!isElectron || isImporting.value || isMergingImport.value || isExporting.value) return

  const ok = await confirm(
    '恢复备份会清空当前所有待办、分类和归档数据，并替换为备份内容；应用设置不会恢复。确定继续吗？'
  )
  if (!ok) return

  const result = await settingsStore.importData()
  if (result.status !== 'success') return

  await app.fetchCategories()
  await app.fetchCurrentTaskPane()
}

async function handleMergeData() {
  if (!isElectron || isMergingImport.value || isImporting.value || isExporting.value) return

  const ok = await confirm(
    '合并导入会保留当前数据；同名分类会并入现有分类，备份中的任务和归档会作为新数据加入，不会按旧 ID 覆盖，可能出现重复内容。确定继续吗？'
  )
  if (!ok) return

  const result = await settingsStore.mergeData()
  if (result.status !== 'success') return

  await app.fetchCategories()
  await app.fetchCurrentTaskPane()
}

async function handleCheckUpdate() {
  if (!isElectron) return
  await updaterStore.checkForUpdates()
}

async function handleDownloadUpdate() {
  if (!isElectron) return
  await updaterStore.downloadUpdate()
}

async function handleInstallUpdate() {
  if (!isElectron) return
  await updaterStore.installUpdate()
}

function handleKeydown(event: KeyboardEvent) {
  if (recordingAction.value) {
    handleRecordKeydown(event)
    return
  }
  if (globalSearchStore.isOpen) {
    return
  }

  // ESC 切回待办视图
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    appSessionStore.setCurrentMainView('tasks')
  }
}

watch(autoCleanupDays, () => {
  if (autoCleanupEnabled.value) {
    void handleAutoCleanupChange()
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('click', handleDropdownOutsideClick, true)
  window.addEventListener('resize', syncOpenDropdownPositions)
  window.addEventListener('scroll', syncOpenDropdownPositions, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('click', handleDropdownOutsideClick, true)
  window.removeEventListener('resize', syncOpenDropdownPositions)
  window.removeEventListener('scroll', syncOpenDropdownPositions, true)
})
</script>

<template>
  <div class="settings-view" tabindex="-1" @keydown="handleKeydown">
    <div class="settings-view__header">
      <div class="settings-view__shell settings-view__shell--header">
        <div class="settings-view__header-left">
          <Settings :size="18" class="settings-view__header-icon" />
          <h2 class="settings-view__title">设置</h2>
        </div>
        <span v-if="settingsStatusText" class="settings-view__meta">
          {{ settingsStatusText }}
        </span>
      </div>
    </div>

    <div class="settings-view__body">
      <div class="settings-view__shell settings-view__shell--body">
        <section class="settings-group">
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
                :disabled="!isElectron || isSavingAutoLaunch"
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
              <span class="settings-item__desc">关闭后仍可通过托盘图标重新打开</span>
            </div>
            <label class="toggle-switch" for="close-to-tray">
              <input
                id="close-to-tray"
                v-model="closeToTray"
                type="checkbox"
                :disabled="!isElectron || isSavingCloseToTray"
                @change="handleCloseToTrayChange"
              />
              <span class="toggle-switch__slider"></span>
            </label>
          </div>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <Keyboard :size="14" class="settings-group__icon" />
            <span>快捷键</span>
            <button class="hotkey-reset-all" type="button" @click="handleResetAll">恢复默认</button>
          </div>

          <div
            v-for="action in hotkeyActions"
            :key="action"
            class="hotkey-row"
            :class="{ 'hotkey-row--active': recordingAction === action }"
          >
            <div class="hotkey-row__info">
              <span class="hotkey-row__name">{{ HOTKEY_LABELS[action].name }}</span>
              <span v-if="isGlobalHotkeyAction(action)" class="hotkey-tag">全局</span>
              <span
                v-if="recordingAction === action && conflictMessage"
                class="hotkey-row__conflict"
              >
                {{ conflictMessage }}
              </span>
              <span v-else class="hotkey-row__desc">{{ HOTKEY_LABELS[action].desc }}</span>
            </div>

            <div class="hotkey-row__actions">
              <span
                v-if="recordingAction === action"
                class="hotkey-key hotkey-key--recording"
                role="status"
              >
                等待输入...
              </span>
              <button
                v-else
                class="hotkey-key"
                type="button"
                title="点击修改快捷键"
                @click="startRecording(action)"
              >
                {{ hotkeyConfig[action].label }}
              </button>
              <button
                v-if="recordingAction === action"
                class="hotkey-action hotkey-action--cancel"
                type="button"
                @click="cancelRecording"
              >
                Esc 取消
              </button>
            </div>
          </div>

          <div class="hotkey-row hotkey-row--fixed">
            <div class="hotkey-row__info">
              <span class="hotkey-row__name">切换分类</span>
              <span class="hotkey-row__desc">Ctrl+1~9 快速切换到对应分类</span>
            </div>
            <div class="hotkey-row__actions">
              <span class="hotkey-key hotkey-key--fixed">Ctrl+1~9</span>
              <span class="hotkey-tag">系统</span>
            </div>
          </div>
        </section>

        <section class="settings-group">
          <div class="settings-group__header">
            <Trash2 :size="14" class="settings-group__icon" />
            <span>数据</span>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label" for="auto-cleanup">自动归档已完成任务</label>
              <span class="settings-item__desc">在每次启动时自动归档达到期限的已完成任务</span>
            </div>
            <label class="toggle-switch" for="auto-cleanup">
              <input
                id="auto-cleanup"
                v-model="autoCleanupEnabled"
                type="checkbox"
                :disabled="!isElectron || isSavingAutoCleanup"
                @change="handleAutoCleanupChange"
              />
              <span class="toggle-switch__slider"></span>
            </label>
          </div>

          <div v-if="autoCleanupEnabled" class="settings-item settings-item--nested">
            <div class="settings-item__info">
              <label class="settings-item__label" for="cleanup-days">归档范围</label>
            </div>
            <div class="cleanup-days-selector">
              <span class="cleanup-days-selector__text">归档</span>
              <div ref="cleanupDropdownRef" class="dropdown dropdown--inline">
                <button
                  class="dropdown__trigger"
                  type="button"
                  :disabled="!isElectron || isSavingAutoCleanup"
                  @click="toggleCleanupDropdown"
                >
                  <span class="dropdown__value">{{ cleanupDisplayLabel }}</span>
                  <ChevronDown
                    :size="11"
                    class="dropdown__chevron"
                    :class="{ 'dropdown__chevron--open': cleanupDropdownOpen }"
                  />
                </button>
                <Transition name="dropdown-pop">
                  <Teleport to="body">
                    <div
                      v-if="cleanupDropdownOpen && cleanupDropdownPosition"
                      ref="cleanupDropdownPanelRef"
                      class="dropdown__panel dropdown__panel--teleported"
                      :style="{
                        top: `${cleanupDropdownPosition.top}px`,
                        left: `${cleanupDropdownPosition.left}px`,
                        minWidth: `${cleanupDropdownPosition.width}px`
                      }"
                    >
                      <button
                        v-for="opt in cleanupDaysOptions"
                        :key="opt.value"
                        class="dropdown__option"
                        :class="{ 'dropdown__option--active': opt.value === autoCleanupDays }"
                        type="button"
                        @click="selectCleanupDays(opt.value)"
                      >
                        {{ opt.label }}
                      </button>
                    </div>
                  </Teleport>
                </Transition>
              </div>
              <span class="cleanup-days-selector__text">前的已完成任务</span>
            </div>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label">
                <Upload :size="14" class="settings-item__inline-icon" />
                恢复备份（覆盖当前数据）
              </label>
              <span class="settings-item__desc">
                从 JSON 备份恢复数据，当前会覆盖现有待办、分类和归档内容
              </span>
            </div>
            <button
              class="settings-item__action-btn"
              type="button"
              :disabled="!isElectron || isImporting || isMergingImport || isExporting"
              @click="handleImportData"
            >
              {{ isImporting ? '恢复中...' : '恢复' }}
            </button>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label">
                <Upload :size="14" class="settings-item__inline-icon" />
                合并导入（仅新增）
              </label>
              <span class="settings-item__desc">
                保留当前数据；同名分类会合并，备份中的任务和归档会作为新数据加入
              </span>
            </div>
            <button
              class="settings-item__action-btn"
              type="button"
              :disabled="!isElectron || isMergingImport || isImporting || isExporting"
              @click="handleMergeData"
            >
              {{ isMergingImport ? '合并中...' : '合并导入' }}
            </button>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <label class="settings-item__label">
                <Download :size="14" class="settings-item__inline-icon" />
                导出备份
              </label>
              <span class="settings-item__desc"
                >将当前待办、分类和归档数据导出为 JSON 备份文件</span
              >
            </div>
            <button
              class="settings-item__action-btn"
              type="button"
              :disabled="!isElectron || isExporting || isImporting || isMergingImport"
              @click="handleExportData"
            >
              {{ isExporting ? '导出中...' : '导出备份' }}
            </button>
          </div>
        </section>

        <section class="settings-group">
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

            <div class="update-section">
              <div class="update-section__row">
                <div class="update-section__main">
                  <span class="update-section__status-text">{{ updaterStatusText }}</span>
                </div>
                <div
                  v-if="updateStatus === 'idle' || updateStatus === 'not-available'"
                  class="update-section__side"
                >
                  <button
                    class="update-section__btn"
                    type="button"
                    :disabled="!isElectron"
                    @click="handleCheckUpdate"
                  >
                    <RefreshCw :size="12" />
                    检查更新
                  </button>
                </div>
              </div>

              <div v-if="updateStatus === 'checking'" class="update-section__content">
                <span class="update-section__text update-section__text--checking">
                  <RefreshCw :size="12" class="update-section__spin" />
                  正在检查更新...
                </span>
              </div>

              <div v-else-if="updateStatus === 'available'" class="update-section__content">
                <span class="update-section__text update-section__text--available">
                  发现新版本 v{{ updateVersion }}
                </span>
                <div class="update-section__action">
                  <button
                    class="update-section__btn update-section__btn--primary"
                    type="button"
                    @click="handleDownloadUpdate"
                  >
                    下载更新
                  </button>
                </div>
              </div>

              <div v-else-if="updateStatus === 'downloading'" class="update-section__content">
                <span class="update-section__text">正在下载更新... {{ updatePercent }}%</span>
                <div class="update-section__progress">
                  <div
                    class="update-section__progress-bar"
                    :style="{ width: updatePercent + '%' }"
                  ></div>
                </div>
              </div>

              <div v-else-if="updateStatus === 'downloaded'" class="update-section__content">
                <span class="update-section__text update-section__text--success">
                  新版本 v{{ updateVersion }} 已下载完成
                </span>
                <div class="update-section__action">
                  <button
                    class="update-section__btn update-section__btn--primary"
                    type="button"
                    @click="handleInstallUpdate"
                  >
                    立即安装
                  </button>
                </div>
              </div>

              <div v-else-if="updateStatus === 'error'" class="update-section__content">
                <span class="update-section__text update-section__text--error">
                  检查失败：{{ updateError }}
                </span>
                <div class="update-section__action">
                  <button class="update-section__btn" type="button" @click="handleCheckUpdate">
                    重试
                  </button>
                </div>
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
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use 'sass:color';
@use '../styles/variables' as *;

/* 内联主视图设置页 */
.settings-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: $bg-primary;
  outline: none;
  overflow: hidden;

  &__header {
    border-bottom: 1px solid $border-subtle;
    background: $bg-primary;
    flex-shrink: 0;
    padding: $spacing-md clamp($spacing-lg, 3vw, $spacing-2xl);
  }

  &__shell {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
  }

  &__shell--header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
  }

  &__shell--body {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
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
    margin: 0;
    font-size: $font-lg;
    font-weight: 700;
    color: $text-primary;
  }

  &__meta {
    font-size: $font-xs;
    color: $text-muted;
    max-width: 240px;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    width: 100%;
    padding: $spacing-xl clamp($spacing-lg, 3vw, $spacing-2xl) $spacing-2xl;
    overscroll-behavior: contain;
    /* 限制内容最大宽度，大屏时不会拉伸过宽 */

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(15, 23, 42, 0.14);
      border-radius: 999px;
    }
  }
}

.settings-group {
  background: $bg-elevated;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: $spacing-md $spacing-lg;
    border-bottom: 1px solid $border-subtle;
    font-size: $font-xs;
    font-weight: 700;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  &__icon {
    color: $accent-color;
  }
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid $border-subtle;
  flex-shrink: 0;

  &:last-child {
    border-bottom: none;
  }

  &--nested {
    background: rgba($accent-color, 0.03);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: $font-sm;
    color: $text-primary;
    font-weight: 500;
  }

  &__desc {
    font-size: $font-xs;
    color: $text-muted;
    line-height: 1.4;
  }

  &__inline-icon {
    color: $text-muted;
  }

  &__action-btn {
    padding: 6px 14px;
    border-radius: $radius-md;
    border: 1px solid rgba($accent-color, 0.18);
    background: $accent-soft;
    color: $accent-color;
    font-size: $font-xs;
    font-weight: 700;
    cursor: pointer;
    transition: all $transition-fast;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
  flex-shrink: 0;

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
    border-radius: 999px;
    transition: all $transition-fast;

    &::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 2px;
      top: 2px;
      border-radius: 50%;
      background: white;
      transition: transform $transition-fast;
      box-shadow: 0 2px 5px rgba(15, 23, 42, 0.18);
    }
  }

  input:checked + &__slider {
    background: $accent-color;
  }

  input:checked + &__slider::before {
    transform: translateX(16px);
  }
}

.hotkey-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: 10px $spacing-lg;
  border-bottom: 1px solid $border-subtle;

  &:last-child {
    border-bottom: none;
  }

  &--active {
    background: rgba($accent-color, 0.04);
  }

  &--fixed {
    opacity: 0.66;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: $font-sm;
    color: $text-primary;
    font-weight: 500;
  }

  &__desc,
  &__conflict {
    font-size: 10px;
    line-height: 1.35;
  }

  &__desc {
    color: $text-muted;
  }

  &__conflict {
    color: $danger-color;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.hotkey-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  padding: 4px 10px;
  border-radius: 8px;
  border: none;
  background: rgba(15, 23, 42, 0.05);
  color: $text-secondary;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;

  &--recording {
    min-width: 88px;
    background: $accent-soft;
    color: $accent-color;
    cursor: default;
  }

  &--fixed {
    cursor: default;
  }
}

.hotkey-action {
  border: none;
  background: transparent;
  color: $text-muted;
  font-size: 10px;
  cursor: pointer;

  &--cancel:hover {
    color: $danger-color;
  }
}

.hotkey-tag {
  font-size: 9px;
  font-weight: 700;
  color: $text-muted;
  text-transform: uppercase;
}

.hotkey-reset-all {
  margin-left: auto;
  border: 1px solid $border-subtle;
  background: transparent;
  color: $text-muted;
  border-radius: $radius-sm;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
}

.cleanup-days-selector {
  display: flex;
  align-items: center;
  gap: 6px;

  &__text {
    font-size: $font-xs;
    color: $text-secondary;
  }
}

/* ---- 自定义 Dropdown 组件 ---- */
.dropdown {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;

  &__trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: $radius-md;
    border: 1px solid $border-color;
    background: $bg-elevated;
    color: $text-primary;
    font-size: $font-sm;
    font-weight: 500;
    cursor: pointer;
    transition: all $transition-fast;
    outline: none;
    min-width: 88px;
    justify-content: space-between;

    &:hover:not(:disabled) {
      border-color: $border-light;
      background: rgba(15, 23, 42, 0.03);
    }

    &:focus-visible {
      border-color: $accent-color;
      box-shadow: $shadow-glow;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__value {
    white-space: nowrap;
  }

  &__chevron {
    color: $text-muted;
    transition:
      transform $transition-fast,
      color $transition-fast;
    flex-shrink: 0;

    &--open {
      transform: rotate(180deg);
      color: $accent-color;
    }
  }

  &__panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 50;
    min-width: 100%;
    padding: 4px;
    border-radius: $radius-md;
    border: 1px solid $border-color;
    background: $bg-elevated;
    box-shadow: $shadow-md;
    display: flex;
    flex-direction: column;
    transform-origin: top left;
  }

  &__panel--teleported {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 260;
  }

  &__option {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    border: none;
    border-radius: $radius-sm;
    background: transparent;
    color: $text-secondary;
    font-size: $font-sm;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all $transition-fast;

    &:hover {
      background: rgba($accent-color, 0.06);
      color: $text-primary;
    }

    &--active {
      color: $accent-color;
      background: $accent-soft;
      font-weight: 600;

      &:hover {
        background: rgba($accent-color, 0.12);
      }
    }
  }

  /* 内联变体 */
  &--inline &__trigger {
    padding: 4px 8px;
    min-width: 60px;
    font-size: $font-xs;
    border-radius: $radius-sm;
    gap: 4px;
  }

  &--inline &__panel {
    padding: 3px;
  }

  &--inline &__option {
    padding: 4px 10px;
    font-size: $font-xs;
  }
}

/* ---- Dropdown 弹出动画 ---- */
.dropdown-pop-enter-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-pop-leave-active {
  transition: all 0.1s ease;
}

.dropdown-pop-enter-from,
.dropdown-pop-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

.settings-about {
  padding: $spacing-lg;
  flex-shrink: 0;

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
  }

  &__name {
    font-size: $font-lg;
    font-weight: 700;
    color: $text-primary;
  }

  &__version {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: $font-xs;
    background: $accent-soft;
    color: $accent-color;
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

.update-section {
  margin-bottom: $spacing-md;
  padding: $spacing-md;
  background: rgba($accent-color, 0.03);
  border: 1px solid rgba($accent-color, 0.08);
  border-radius: $radius-md;
  flex-shrink: 0;
  display: block;

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: $spacing-md;
    align-items: center;
    min-height: 40px;
  }

  &__main {
    min-width: 0;
    user-select: text;
    display: flex;
    align-items: center;
    min-height: 100%;
  }

  &__side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    user-select: none;
    min-height: 100%;
  }

  &__status-text,
  &__text {
    display: block;
    font-size: $font-xs;
    color: $text-secondary;
    line-height: 1.45;
    user-select: text;
  }

  &__content {
    display: block;
    user-select: text;
    margin-top: $spacing-sm;
  }

  &__action {
    margin-top: $spacing-sm;
    user-select: none;
  }

  &__text--checking,
  &__text--available {
    color: $accent-color;
  }

  &__text--success {
    color: #22c55e;
  }

  &__text--error {
    color: $danger-color;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border-radius: $radius-sm;
    border: 1px solid $border-subtle;
    background: rgba(15, 23, 42, 0.05);
    color: $text-secondary;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition:
      background-color $transition-fast,
      border-color $transition-fast,
      color $transition-fast;

    &--primary {
      background: $accent-color;
      border-color: $accent-color;
      color: white;
    }
  }

  &__progress {
    width: 100%;
    height: 4px;
    margin-top: $spacing-sm;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.08);
    overflow: hidden;
  }

  &__progress-bar {
    height: 100%;
    background: linear-gradient(90deg, $accent-color, color.adjust($accent-color, $lightness: 8%));
  }

  &__spin {
    animation: spin 1s linear infinite;
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

@media (max-width: 720px) {
  .settings-view {
    &__header {
      padding-inline: $spacing-lg;
    }

    &__body {
      padding: $spacing-lg;
    }

    &__shell--header {
      align-items: flex-start;
      flex-direction: column;
    }

    &__meta {
      max-width: none;
      text-align: left;
      white-space: normal;
    }
  }
}
</style>
