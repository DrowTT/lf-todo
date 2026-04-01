<script setup lang="ts">
import { ref } from 'vue'
import { useAppBootstrap } from './app/useAppBootstrap'
import CategoryList from './components/CategoryList.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ToastMessage from './components/ToastMessage.vue'
import TodoList from './components/TodoList.vue'
import { useAppRuntime } from './app/runtime'
import { useHotkeys } from './composables/useHotkeys'
import { useSidebarResize } from './composables/useSidebarResize'
import TitleBar from './layout/TitleBar.vue'

const { current, handleConfirm, handleCancel } = useAppRuntime().confirm
const { sidebarWidth, startResize } = useSidebarResize()

useAppBootstrap()
useHotkeys()

const showSettings = ref(false)
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <div class="app-content">
      <div :style="{ width: sidebarWidth + 'px' }" class="sidebar-wrapper">
        <CategoryList @open-settings="showSettings = true" />
      </div>
      <div class="resizer" :style="{ left: sidebarWidth + 'px' }" @mousedown="startResize"></div>
      <TodoList />
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
