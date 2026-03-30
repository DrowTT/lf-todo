<script setup lang="ts">
/**
 * DeviceKickedDialog — 设备被踢出提示弹窗
 * 当前设备被新设备挤出时显示
 */
import { useAuthStore } from '../store/auth'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  confirm: []
}>()

const authStore = useAuthStore()

async function handleConfirm(): Promise<void> {
  await authStore.forceLogout()
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="kicked-overlay">
      <div class="kicked-dialog">
        <div class="kicked-icon">⚠️</div>
        <h3 class="kicked-title">账号已在其他设备登录</h3>
        <p class="kicked-desc">
          你的账号已在另一台设备上登录，当前设备已被自动下线。
          如非本人操作，请及时修改密码。
        </p>
        <button class="kicked-btn" @click="handleConfirm">
          返回登录
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.kicked-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.kicked-dialog {
  width: 360px;
  padding: $spacing-2xl;
  background: $bg-elevated;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  text-align: center;
}

.kicked-icon {
  font-size: 48px;
  margin-bottom: $spacing-md;
}

.kicked-title {
  font-size: $font-xl;
  font-weight: 600;
  color: $text-primary;
  margin: 0 0 $spacing-sm;
}

.kicked-desc {
  font-size: $font-md;
  color: $text-secondary;
  line-height: 1.6;
  margin: 0 0 $spacing-xl;
}

.kicked-btn {
  width: 100%;
  height: 40px;
  background: $accent-color;
  color: white;
  border: none;
  border-radius: $radius-md;
  font-size: $font-md;
  font-weight: 500;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover {
    background: $accent-hover;
  }
}
</style>
