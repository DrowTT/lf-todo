<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useAppFacade } from './app/facade/useAppFacade'
import { useAppBootstrap } from './app/useAppBootstrap'
import { useAppRuntime } from './app/runtime'
import ConfirmDialog from './components/ConfirmDialog.vue'
import GlobalSearchDialog from './components/GlobalSearchDialog.vue'
import PomodoroView from './components/PomodoroView.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ToastMessage from './components/ToastMessage.vue'
import TodoList from './components/TodoList.vue'
import { useHotkeys } from './composables/useHotkeys'
import ActivityBar from './layout/ActivityBar.vue'
import TitleBar from './layout/TitleBar.vue'
import { MIN_MAIN_WINDOW_WIDTH } from '../../shared/constants/layout'
import { useAppSessionStore } from './store/appSession'
import { useGlobalSearchStore } from './store/globalSearch'
import { usePomodoroStore } from './store/pomodoro'
import { useSettingsStore } from './store/settings'

const runtime = useAppRuntime()
const app = useAppFacade()
const { current, handleConfirm, handleCancel, confirm } = runtime.confirm
const pomodoroStore = usePomodoroStore()
const settingsStore = useSettingsStore()
const appSessionStore = useAppSessionStore()
const globalSearchStore = useGlobalSearchStore()
const INTERACTIVE_FOCUS_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

useAppBootstrap()
useHotkeys()

const currentMainView = computed(() => appSessionStore.currentMainView)

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false

  return target.matches(INTERACTIVE_FOCUS_SELECTOR) || !!target.closest(INTERACTIVE_FOCUS_SELECTOR)
}

function shouldHideWindowOnEscape(event: KeyboardEvent): boolean {
  if (!runtime.window.isAvailable) return false
  if (event.defaultPrevented) return false
  if (event.key !== 'Escape') return false
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false
  if (current.value !== null) return false
  if (globalSearchStore.isOpen) return false
  if (currentMainView.value === 'settings') return false
  if (isInteractiveElement(event.target)) return false
  if (isInteractiveElement(document.activeElement)) return false

  return true
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (!shouldHideWindowOnEscape(event)) return

  event.preventDefault()
  event.stopPropagation()
  runtime.window.hideToTray()
}

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
let stopQuickAddCommittedListener: (() => void) | null = null

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)

  if (runtime.window.isAvailable) {
    stopQuitRequestedListener = runtime.window.onQuitRequested(() => {
      void handleQuitRequested()
    })
    stopQuickAddCommittedListener = runtime.window.onQuickAddCommitted(() => {
      void app.fetchCategories()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  stopQuitRequestedListener?.()
  stopQuickAddCommittedListener?.()
})
</script>

<template>
  <div class="app-container">
    <TitleBar @close-request="handleCloseRequest" />
    <div class="app-content" :style="{ minWidth: `${MIN_MAIN_WINDOW_WIDTH}px` }">
      <ActivityBar />
      <TodoList v-if="currentMainView === 'tasks'" />
      <PomodoroView v-else-if="currentMainView === 'pomodoro'" />
      <SettingsPanel v-else-if="currentMainView === 'settings'" />
    </div>
    <ConfirmDialog
      :visible="current !== null"
      :message="current?.message ?? ''"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
    <GlobalSearchDialog />
    <ToastMessage />
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
}
</style>
