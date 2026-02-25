<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { message, hide } = useToast()
</script>

<template>
  <Transition name="toast">
    <div v-if="message" class="toast" :class="`toast--${message.type}`" @click="hide">
      <span class="toast-icon">
        <svg v-if="message.type === 'error'" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 10.5h-1.5v-1.5h1.5v1.5zm0-3h-1.5V4h1.5v4.5z"
          />
        </svg>
        <svg v-else-if="message.type === 'success'" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.22 5.03-4 4a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06l1.47 1.47 3.47-3.47a.75.75 0 1 1 1.06 1.06z"
          />
        </svg>
        <svg v-else viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 10.5h-1.5v-1.5h1.5v1.5zm0-3h-1.5V5h1.5v3.5z"
          />
        </svg>
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
  padding: $spacing-sm $spacing-lg;
  border-radius: $radius-lg;
  font-size: $font-md;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  max-width: 320px;
  word-break: break-word;

  &--error {
    background: #c0392b;
  }
  &--success {
    background: #27ae60;
  }
  &--info {
    background: $accent-color;
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

// 进出动画
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity $transition-normal,
    transform $transition-normal;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
