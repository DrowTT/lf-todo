<script setup lang="ts">
import TitleBar from './layout/TitleBar.vue'
import CategoryList from './components/CategoryList.vue'
import TodoList from './components/TodoList.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastMessage from './components/ToastMessage.vue'
import { useConfirm } from './composables/useConfirm'
import { useSidebarResize } from './composables/useSidebarResize'

const { current, handleConfirm, handleCancel } = useConfirm()
const { sidebarWidth, startResize } = useSidebarResize()
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <div class="app-content">
      <div :style="{ width: sidebarWidth + 'px' }" class="sidebar-wrapper">
        <CategoryList />
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
    <!-- 全局操作结果提示 -->
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
  position: relative;
}

.sidebar-wrapper {
  height: 100%;
  flex-shrink: 0;
}

/* 拖拽条样式 */
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
