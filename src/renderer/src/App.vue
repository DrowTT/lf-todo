<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useAppBootstrap } from './app/useAppBootstrap'
import CategoryList from './components/CategoryList.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import PomodoroView from './components/PomodoroView.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ToastMessage from './components/ToastMessage.vue'
import TodoList from './components/TodoList.vue'
import { useAppRuntime } from './app/runtime'
import { useHotkeys } from './composables/useHotkeys'
import { useSidebarResize } from './composables/useSidebarResize'
import TitleBar from './layout/TitleBar.vue'
import { useAppSessionStore } from './store/appSession'
import { usePomodoroStore } from './store/pomodoro'
import { useSettingsStore } from './store/settings'

const runtime = useAppRuntime()
const { current, handleConfirm, handleCancel, confirm } = runtime.confirm
const pomodoroStore = usePomodoroStore()
const settingsStore = useSettingsStore()
const { sidebarWidth, startResize } = useSidebarResize()
const appSessionStore = useAppSessionStore()

useAppBootstrap()
useHotkeys()

const showSettings = computed({
  get: () => appSessionStore.settingsPanelOpen,
  set: (value: boolean) => appSessionStore.setSettingsPanelOpen(value)
})

const currentMainView = computed(() => appSessionStore.currentMainView)

async function confirmQuitIfNeeded(): Promise<boolean> {
  if (!pomodoroStore.activeSession) return true

  const confirmed = await confirm('退出将终止当前番茄钟，且不会记录本次专注。确认继续退出吗？')
  if (!confirmed) return false

  await settingsStore.setPomodoroActiveSession(null)
  return true
}

async function handleCloseRequest() {
  if (!runtime.window.isAvailable) return

  if (settingsStore.settings.closeToTray || !pomodoroStore.activeSession) {
    runtime.window.close()
    return
  }

  const confirmed = await confirmQuitIfNeeded()
  if (!confirmed) return

  runtime.window.quit()
}

async function handleQuitRequested() {
  if (!runtime.window.isAvailable) return

  const confirmed = await confirmQuitIfNeeded()
  if (!confirmed) return

  runtime.window.quit()
}

let stopQuitRequestedListener: (() => void) | null = null

onMounted(() => {
  if (runtime.window.isAvailable) {
    stopQuitRequestedListener = runtime.window.onQuitRequested(() => {
      void handleQuitRequested()
    })
  }
})

onUnmounted(() => {
  stopQuitRequestedListener?.()
})
</script>

<template>
  <div class="app-container">
    <TitleBar @close-request="handleCloseRequest" />
    <div class="app-content">
      <div :style="{ width: sidebarWidth + 'px' }" class="sidebar-wrapper">
        <CategoryList @open-settings="showSettings = true" />
      </div>
      <div class="resizer" :style="{ left: sidebarWidth + 'px' }" @mousedown="startResize"></div>
      <TodoList v-if="currentMainView === 'tasks'" />
      <PomodoroView v-else />
    </div>
    <ConfirmDialog
      :visible="current !== null"
      :message="current?.message ?? ''"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
    <ToastMessage />
    <SettingsPanel :visible="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped lang="scss">
@use './styles/variables' as *;

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-deep;
  color: $text-primary;
}

.app-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.sidebar-wrapper {
  height: 100%;
  flex-shrink: 0;
}

.resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: col-resize;
  background: transparent;
  z-index: 99;
  transform: translateX(-50%);

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: transparent;
    transition: background $transition-normal;
  }

  &:hover::after {
    background: $accent-color;
  }
}
</style>
