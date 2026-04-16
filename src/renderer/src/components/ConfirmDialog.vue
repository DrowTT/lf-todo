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

const contentRef = ref<HTMLElement | null>(null)

const handleConfirm = (): void => {
  emit('confirm')
}

const handleCancel = (): void => {
  emit('cancel')
}

// 弹窗出现时自动聚焦，使 keydown 能捕获
watch(
  () => props.visible,
  (val) => {
    if (val) nextTick(() => contentRef.value?.focus())
  }
)
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩层：独立元素，只做 opacity 动画，无 backdrop-filter -->
    <Transition name="fade">
      <div v-if="visible" class="dialog-overlay" @click="handleCancel" />
    </Transition>

    <!-- 弹窗容器：独立元素，只做 transform 动画，不做 opacity -->
    <Transition name="slide">
      <div
        v-if="visible"
        class="dialog-wrapper"
        @click.self="handleCancel"
        @keydown.enter.stop.prevent="handleConfirm"
        @keydown.escape.stop.prevent="handleCancel"
      >
        <div ref="contentRef" class="dialog-content" tabindex="-1" @click.stop>
          <p class="dialog-message">{{ message }}</p>
          <div class="dialog-actions">
            <button class="dialog-btn dialog-btn--cancel" @click="handleCancel">取消</button>
            <button class="dialog-btn dialog-btn--confirm" @click="handleConfirm">确认</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

/* 遮罩层 — 独立层，自带 backdrop-filter 模糊整个背景 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 9998;
}

/* 弹窗外层定位容器 — 不对 opacity 动画，所以不影响子元素的 backdrop-filter */
.dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* 弹窗本体 — 毛玻璃效果 */
.dialog-content {
  min-width: 320px;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: $radius-xl;
  box-shadow: $shadow-lg;
  padding: $spacing-2xl;
  outline: none;
}

.dialog-message {
  font-size: $font-lg;
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
  padding: $spacing-sm $spacing-xl;
  border-radius: $radius-md;
  font-size: $font-sm;
  font-weight: 500;
  cursor: pointer;
  transition: all $transition-normal;
  border: none;

  &--cancel {
    background: rgba(0, 0, 0, 0.05);
    color: $text-secondary;
    border: 1px solid $border-color;

    &:hover {
      background: rgba(0, 0, 0, 0.08);
      color: $text-primary;
    }
  }

  &--confirm {
    background: $accent-color;
    color: white;

    &:hover {
      background: $accent-hover;
      box-shadow: 0 0 12px $accent-glow;
    }
  }
}

/* 遮罩层动画 — 用 background-color 过渡（入场），opacity+background（离场） */
.fade-enter-active {
  transition: background-color $transition-slow;
}

.fade-leave-active {
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.fade-enter-from {
  background-color: transparent;
}

.fade-leave-to {
  background-color: transparent;
  opacity: 0;
}

/* 弹窗动画 — 入场：仅 transform；离场：transform + opacity 同步淡出 */
.slide-enter-active {
  transition: transform $transition-spring;
}

.slide-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-enter-from {
  transform: translateY(12px) scale(0.97);
}

.slide-leave-to {
  transform: translateY(8px) scale(0.97);
  opacity: 0;
}
</style>
