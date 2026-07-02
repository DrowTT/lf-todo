<template>
  <div class="title-bar" :class="{ 'title-bar--mac': isMac }">
    <div class="title-bar__drag-area">
      <div class="title-bar__title">
        <span class="title-bar__dot"></span>
        极简待办
      </div>
      <div
        v-if="codexStatusVisible"
        class="title-bar__codex-status"
        :class="`title-bar__codex-status--${codexStatusVariant}`"
        :title="codexStatusTitle"
      >
        <span class="title-bar__codex-dot"></span>
        <span class="title-bar__codex-text">{{ codexStatusLabel }}</span>
      </div>
    </div>
    <div class="title-bar__controls">
      <button
        class="title-bar__search"
        :title="`全局搜索（${globalSearchShortcutLabel}）`"
        @click="handleOpenGlobalSearch"
      >
        <Search :size="14" />
        <span class="title-bar__search-text">搜索</span>
        <span class="title-bar__search-key">{{ globalSearchShortcutLabel }}</span>
      </button>
      <button
        v-if="!isMac"
        class="title-bar__btn title-bar__btn--pin"
        :class="{ 'is-active': isAlwaysOnTop }"
        title="置顶"
        @click="handleTogglePin"
      >
        <Pin :size="15" style="transform: rotate(45deg)" />
      </button>
      <template v-if="!isMac">
        <button
          class="title-bar__btn title-bar__btn--minimize"
          title="最小化"
          @click="handleMinimize"
        >
          <Minus :size="14" />
        </button>
        <button
          class="title-bar__btn title-bar__btn--maximize"
          :title="isMaximized ? '还原' : '最大化'"
          @click="handleToggleMaximize"
        >
          <IconRestore v-if="isMaximized" />
          <Square v-else :size="13" :stroke-width="1.4" />
        </button>
        <button class="title-bar__btn title-bar__btn--close" title="关闭" @click="handleClose">
          <X :size="14" />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Minus, Pin, Search, Square, X } from 'lucide-vue-next'
import { useAppRuntime } from '../app/runtime'
import IconRestore from '../components/icons/IconRestore.vue'
import { useHotkeys } from '../composables/useHotkeys'
import { useGlobalSearchStore } from '../store/globalSearch'
import type { CodexControlStatusEvent } from '../../../shared/types/models'

const emit = defineEmits<{
  'close-request': []
}>()

const isAlwaysOnTop = ref(false)
const isMaximized = ref(false)
const windowService = useAppRuntime().window
const { hotkeyConfig } = useHotkeys()
const globalSearchStore = useGlobalSearchStore()
const stopAlwaysOnTopListener = ref<(() => void) | null>(null)
const stopMaximizedListener = ref<(() => void) | null>(null)
const stopCodexControlStatusListener = ref<(() => void) | null>(null)
const codexStatus = ref<CodexControlStatusEvent | null>(null)
let codexStatusTimer: ReturnType<typeof setTimeout> | null = null
const isMac = computed(() => navigator.platform.toLowerCase().includes('mac'))
const globalSearchShortcutLabel = computed(() => hotkeyConfig.openGlobalSearch.label)
const codexStatusVisible = computed(() => codexStatus.value !== null)
const codexStatusVariant = computed(() => {
  if (codexStatus.value?.status === 'changed') return 'changed'
  return 'running'
})
const codexStatusLabel = computed(() => {
  if (codexStatus.value?.status === 'changed') return 'Codex 已更新'
  return 'Codex 正在操作'
})
const codexStatusTitle = computed(() => {
  const current = codexStatus.value
  if (!current) return ''

  const action =
    current.method === 'applyTaskOperations'
      ? current.operationCount > 0
        ? `整理 ${current.operationCount} 项`
        : '整理待办'
      : '读取待办'

  return `${codexStatusLabel.value}：${action}`
})

function clearCodexStatusTimer(): void {
  if (!codexStatusTimer) return
  clearTimeout(codexStatusTimer)
  codexStatusTimer = null
}

function scheduleCodexStatusClear(delayMs: number): void {
  clearCodexStatusTimer()
  codexStatusTimer = setTimeout(() => {
    codexStatus.value = null
    codexStatusTimer = null
  }, delayMs)
}

function handleCodexControlStatus(payload: CodexControlStatusEvent): void {
  if (payload.status === 'running') {
    clearCodexStatusTimer()
    codexStatus.value = payload
    return
  }

  if (payload.status === 'changed') {
    codexStatus.value = payload
    scheduleCodexStatusClear(3200)
    return
  }

  scheduleCodexStatusClear(700)
}

const handleTogglePin = () => {
  if (windowService.isAvailable) {
    windowService.toggleAlwaysOnTop()
  }
}

const handleMinimize = () => {
  if (windowService.isAvailable) {
    windowService.minimize()
  }
}

const handleToggleMaximize = () => {
  if (windowService.isAvailable) {
    windowService.toggleMaximize()
  }
}

const handleClose = () => {
  emit('close-request')
}

const handleOpenGlobalSearch = () => {
  globalSearchStore.open({
    scope: 'all'
  })
}

onMounted(() => {
  if (windowService.isAvailable) {
    stopAlwaysOnTopListener.value = windowService.onAlwaysOnTopChanged((flag: boolean) => {
      isAlwaysOnTop.value = flag
    })
    stopMaximizedListener.value = windowService.onMaximizedChanged((flag: boolean) => {
      isMaximized.value = flag
    })
    stopCodexControlStatusListener.value =
      windowService.onCodexControlStatusChanged(handleCodexControlStatus)
  }
})

onUnmounted(() => {
  stopAlwaysOnTopListener.value?.()
  stopMaximizedListener.value?.()
  stopCodexControlStatusListener.value?.()
  clearCodexStatusTimer()
})
</script>

<style scoped lang="scss">
@use '../styles/variables' as *;

.title-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  background: $bg-sidebar;
  color: $text-primary;
  user-select: none;
  border-bottom: 1px solid $border-color;
}

.title-bar--mac {
  padding-left: 70px;
}

.title-bar--mac .title-bar__title {
  display: none;
}

.title-bar--mac .title-bar__controls {
  position: absolute;
  left: 50%;
  top: 50%;
  height: auto;
  transform: translate(-50%, -50%);
}

.title-bar--mac .title-bar__search {
  margin-right: 0;
}

.title-bar__drag-area {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding-left: $spacing-lg;
  -webkit-app-region: drag;
}

.title-bar__title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: $font-sm;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: $text-secondary;
}

.title-bar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $accent-color;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba($accent-color, 0.3);
}

.title-bar__codex-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  margin-left: 12px;
  padding: 0 9px;
  border: 1px solid rgba($border-light, 0.78);
  border-radius: 999px;
  background: rgba($bg-elevated, 0.78);
  color: $text-secondary;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(26, 91, 140, 0.08);
}

.title-bar__codex-status--changed {
  border-color: rgba($success-color, 0.28);
  background: rgba($success-color, 0.1);
  color: $success-color;
}

.title-bar__codex-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $accent-color;
  box-shadow: 0 0 0 3px rgba($accent-color, 0.12);
  flex-shrink: 0;
}

.title-bar__codex-status--changed .title-bar__codex-dot {
  background: $success-color;
  box-shadow: 0 0 0 3px rgba($success-color, 0.12);
}

.title-bar__codex-text {
  display: inline-flex;
  align-items: center;
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-bar__controls {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.title-bar__search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  margin-right: 6px;
  padding: 0 12px;
  border: 1px solid rgba($border-light, 0.7);
  border-radius: 999px;
  background: rgba($bg-elevated, 0.84);
  color: $text-secondary;
  cursor: pointer;
  outline: none;
  transition:
    border-color $transition-fast,
    background-color $transition-fast,
    color $transition-fast;

  &:hover {
    border-color: rgba($accent-color, 0.24);
    color: $text-primary;
  }
}

.title-bar__search-text {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  line-height: 1;
}

.title-bar__search-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba($bg-deep, 0.84);
  color: $text-muted;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.title-bar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  background: transparent;
  border: none;
  color: $text-muted;
  font-size: $font-sm;
  cursor: pointer;
  outline: none;
  transition:
    background-color $transition-fast,
    color $transition-fast;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: $text-primary;
  }
}

.title-bar__btn--pin {
  &.is-active {
    background: $accent-soft;
    color: $accent-color;
  }

  &:hover {
    background: $accent-soft;
    color: $accent-color;
  }
}

.title-bar__btn--close {
  &:hover {
    background: $danger-color;
    color: white;
  }
}
</style>
