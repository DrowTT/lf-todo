<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  message: string
  visible: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const containerRef = ref<HTMLElement | null>(null)

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}

// 弹窗出现时自动聚焦到容器，使内部 keydown 能够捕获键盘事件
watch(
  () => props.visible,
  (val) => {
    if (val) nextTick(() => containerRef.value?.focus())
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="visible"
        class="dialog-overlay"
        @click="handleCancel"
        @keydown.enter.prevent="handleConfirm"
        @keydown.escape="handleCancel"
      >
        <div class="dialog-container" @click.stop tabindex="-1" ref="containerRef">
          <div class="dialog-content">
            <p class="dialog-message">{{ message }}</p>
            <div class="dialog-actions">
              <button @click="handleCancel" class="dialog-btn dialog-btn--cancel">取消</button>
              <button @click="handleConfirm" class="dialog-btn dialog-btn--confirm">确认</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog-container {
  min-width: 300px;
  max-width: 400px;
}

.dialog-content {
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: $spacing-xl;
}

.dialog-message {
  font-size: $font-md;
  color: $text-primary;
  line-height: 1.6;
  margin-bottom: $spacing-xl;
  text-align: center;
}

.dialog-actions {
  display: flex;
  gap: $spacing-md;
  justify-content: flex-end;
}

.dialog-btn {
  padding: $spacing-sm $spacing-lg;
  border-radius: $radius-sm;
  font-size: $font-sm;
  cursor: pointer;
  transition: all $transition-fast;
  border: 1px solid $border-color;
  background: transparent;
  color: $text-secondary;

  &:hover {
    background: $bg-hover;
    color: $text-primary;
  }

  &--cancel {
    // 使用默认样式
  }

  &--confirm {
    color: $text-primary;
    border-color: $text-secondary;

    &:hover {
      background: $bg-hover;
      border-color: $text-primary;
    }
  }
}

// 过渡动画
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity $transition-normal;

  .dialog-container {
    transition: transform $transition-normal;
  }
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;

  .dialog-container {
    transform: scale(0.9);
  }
}
</style>
