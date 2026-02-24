<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { store } from '../store'
import { useAutoHeight } from '../composables/useAutoHeight'

const content = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const { adjustHeight } = useAutoHeight(textareaRef)

const handleSubmit = async () => {
  if (!content.value.trim()) return
  // UX2：currentCategoryId 为 null 时组件根本不渲染，此判断是死代码，直接移除
  await store.addTask(content.value.trim())
  content.value = ''
  nextTick(() => {
    const el = textareaRef.value
    if (el) el.style.height = 'auto'
  })
}
</script>

<template>
  <div class="todo-input">
    <div class="todo-input__label">创建待办</div>
    <textarea
      ref="textareaRef"
      v-model="content"
      rows="1"
      class="todo-input__field"
      placeholder="输入待办内容..."
      maxlength="100"
      :disabled="store.isLoading"
      @input="adjustHeight"
      @keydown.enter.exact.prevent="handleSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-input {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: $bg-tertiary;
  border-bottom: 1px solid $border-color;

  &__label {
    font-size: $font-sm;
    color: $text-secondary;
    white-space: nowrap;
  }

  &__field {
    flex: 1;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-sm;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    outline: none;
    transition: border-color $transition-fast;
    resize: none; // 禁用手动拖拽
    overflow: hidden; // 隐藏滚动条，高度完全由 JS 控制
    font-family: inherit;
    line-height: 1.5;

    &:focus {
      border-color: $accent-color;
    }

    &::placeholder {
      color: $text-muted;
    }
  }
}
</style>
