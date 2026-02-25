<script setup lang="ts">
import TitleBar from './layout/TitleBar.vue'
import CategoryList from './components/CategoryList.vue'
import TodoList from './components/TodoList.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useConfirm } from './composables/useConfirm'
import { useSidebarResize } from './composables/useSidebarResize'

const { state, handleConfirm, handleCancel } = useConfirm()
const { sidebarWidth, startResize } = useSidebarResize()
</script>

<template>
  <div class="app-container font-sans">
    <TitleBar />
    <div class="app-content flex flex-1 overflow-hidden relative">
      <div :style="{ width: sidebarWidth + 'px' }" class="sidebar-wrapper">
        <CategoryList />
      </div>
      <div class="resizer" :style="{ left: sidebarWidth + 'px' }" @mousedown="startResize"></div>
      <TodoList />
    </div>
    <ConfirmDialog
      :visible="state.visible"
      :message="state.message"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
  </div>
</template>

<style scoped lang="scss">
@use './styles/variables' as *;

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-primary;
  color: $text-primary;
}

.sidebar-wrapper {
  height: 100%;
  flex-shrink: 0;
  // CategoryList inside will fill this width
}

/* 拖拽条样式 */
.resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px; /* 加宽感应区域 */
  cursor: col-resize;
  background: transparent;
  z-index: 99;
  transform: translateX(-50%); /* 居中于边界线 */
}
</style>
