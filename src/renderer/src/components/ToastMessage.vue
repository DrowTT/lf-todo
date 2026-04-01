<script setup lang="ts">
import { CircleAlert, CircleCheck, Info } from 'lucide-vue-next'
import { useAppRuntime } from '../app/runtime'

const { message, hide } = useAppRuntime().toast
</script>

<template>
  <Transition name="toast">
    <div v-if="message" class="toast" :class="`toast--${message.type}`" @click="hide">
      <span class="toast-icon">
        <CircleAlert v-if="message.type === 'error'" :size="16" />
        <CircleCheck v-else-if="message.type === 'success'" :size="16" />
        <Info v-else :size="16" />
      </span>
      <span class="toast-text">{{ message.text }}</span>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-lg;
  border-radius: $radius-lg;
  font-size: $font-md;
  cursor: pointer;
  max-width: 360px;
  word-break: break-word;

  // 通用毛玻璃底层
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: $shadow-lg;

  &--error {
    background: rgba(239, 68, 68, 0.85);
    color: white;
  }
  &--success {
    background: rgba(34, 197, 94, 0.85);
    color: white;
  }
  &--info {
    background: rgba(59, 130, 246, 0.85);
    color: white;
  }
}

.toast-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  svg {
    width: 100%;
    height: 100%;
  }
}

.toast-text {
  font-weight: 500;
  line-height: 1.4;
}

// 进出动画
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity $transition-slow,
    transform $transition-spring;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
</style>
