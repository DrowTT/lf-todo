<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { SendHorizonal } from 'lucide-vue-next'
import { store } from '../store'
import { useAutoHeight } from '../composables/useAutoHeight'

const content = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const { adjustHeight, resetHeight } = useAutoHeight(textareaRef)

// 是否有有效输入内容
const hasContent = computed(() => content.value.trim().length > 0)

const handleSubmit = async (): Promise<void> => {
  if (!hasContent.value) return
  await store.addTask(content.value.trim())
  content.value = ''
  nextTick(resetHeight)
}
</script>

<template>
  <div class="todo-input">
    <div class="todo-input__wrapper">
      <textarea
        ref="textareaRef"
        v-model="content"
        rows="1"
        class="todo-input__field"
        placeholder="✏️ 添加新的待办事项..."
        maxlength="100"
        :disabled="store.isLoading"
        @input="adjustHeight"
        @keydown.enter.exact.prevent="handleSubmit"
      />
      <button
        class="todo-input__btn"
        :class="{ 'todo-input__btn--active': hasContent }"
        :disabled="!hasContent || store.isLoading"
        @click="handleSubmit"
      >
        <SendHorizonal :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-input {
  padding: $spacing-md $spacing-xl;

  // 包裹层：让输入框和按钮融为一体
  &__wrapper {
    display: flex;
    align-items: stretch;
    border: 1px solid $border-light;
    border-radius: $radius-lg;
    background: $bg-input;
    transition: all $transition-normal;
    overflow: hidden;

    &:focus-within {
      border-color: $accent-color;
      box-shadow: 0 0 0 3px $accent-soft, $shadow-glow;
      background: rgba($bg-input, 0.8);
    }
  }

  &__field {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: $text-primary;
    font-size: $font-md;
    padding: $spacing-md $spacing-lg;
    border: none;
    border-radius: 0;
    outline: none;
    resize: none;
    overflow: hidden;
    font-family: inherit;
    line-height: 1.5;

    &::placeholder {
      color: $text-muted;
    }

    &:disabled {
      opacity: 0.5;
    }
  }

  // 确认按钮 — 和输入框拼接
  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: $text-muted;
    cursor: not-allowed;
    transition: all $transition-normal;

    &--active {
      background: $accent-color;
      color: #fff;
      cursor: pointer;

      &:hover {
        background: $accent-hover;
      }

      &:active svg {
        transform: scale(0.82);
      }
    }

    svg {
      transition: transform $transition-fast;
    }

    &:disabled:not(.todo-input__btn--active) {
      opacity: 0.4;
    }
  }
}
</style>
