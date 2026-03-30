<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TitleBar from './layout/TitleBar.vue'
import CategoryList from './components/CategoryList.vue'
import TodoList from './components/TodoList.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastMessage from './components/ToastMessage.vue'
import AuthPage from './components/AuthPage.vue'
import DeviceKickedDialog from './components/DeviceKickedDialog.vue'
import ProUpgradeDialog from './components/ProUpgradeDialog.vue'
import { useConfirm } from './composables/useConfirm'
import { useSidebarResize } from './composables/useSidebarResize'
import { useHotkeys } from './composables/useHotkeys'
import { useAuthStore } from './store/auth'

const { current, handleConfirm, handleCancel } = useConfirm()
const { sidebarWidth, startResize } = useSidebarResize()
const authStore = useAuthStore()

// 初始化全局快捷键系统
useHotkeys()

// 设置面板显隐状态
const showSettings = ref(false)
// 设备踢出弹窗
const showKickedDialog = ref(false)
// Pro 升级弹窗
const showProUpgrade = ref(false)

// 启动时检查认证状态
onMounted(async () => {
  await authStore.checkAuth()

  // 监听强制登出事件（Token 刷新失败时触发）
  window.addEventListener('auth:force-logout', () => {
    showKickedDialog.value = true
  })
})

function handleKickedConfirm(): void {
  showKickedDialog.value = false
}
</script>

<template>
  <div class="app-container">
    <!-- 加载状态 -->
    <div v-if="authStore.isChecking" class="loading-screen">
      <div class="loading-spinner" />
    </div>

    <!-- 未登录：显示认证页 -->
    <AuthPage v-else-if="!authStore.isLoggedIn" />

    <!-- 已登录：显示主界面 -->
    <template v-else>
      <TitleBar />
      <div class="app-content">
        <div :style="{ width: sidebarWidth + 'px' }" class="sidebar-wrapper">
          <CategoryList @open-settings="showSettings = true" @show-pro-upgrade="showProUpgrade = true" />
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
      <!-- 设置面板 -->
      <SettingsPanel :visible="showSettings" @close="showSettings = false" @show-pro-upgrade="showProUpgrade = true" />
    </template>

    <!-- 设备踢出弹窗（全局层级） -->
    <DeviceKickedDialog
      :visible="showKickedDialog"
      @confirm="handleKickedConfirm"
    />

    <!-- Pro 升级弹窗（全局层级） -->
    <ProUpgradeDialog
      :visible="showProUpgrade"
      @close="showProUpgrade = false"
    />
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

/* 加载状态 */
.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid $border-color;
  border-top-color: $accent-color;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
