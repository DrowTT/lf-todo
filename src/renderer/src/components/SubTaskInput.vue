<script setup lang="ts">
import { ref } from 'vue'
import { store } from '../store'

const props = defineProps<{
  parentId: number
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const content = ref('')

// 提交子任务
const handleSubmit = async () => {
  const trimmed = content.value.trim()
  if (!trimmed) return
  await store.addSubTask(trimmed, props.parentId)
  content.value = ''
  inputRef.value?.focus()
}
</script>

<template>
  <div class="subtask-input">
    <span class="subtask-input__icon">+</span>
    <input
      ref="inputRef"
      v-model="content"
      class="subtask-input__field"
      placeholder="添加子任务…"
      maxlength="200"
      @keydown.enter.exact.prevent="handleSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.subtask-input {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 4px $spacing-sm 4px 28px; // 与 SubTaskItem 一致的左缩进

  &__icon {
    flex-shrink: 0;
    font-size: 14px;
    color: $text-muted;
    line-height: 1;
    user-select: none;
  }

  &__field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: $text-secondary;
    font-size: $font-xs;
    font-family: inherit;
    padding: 0;

    &::placeholder {
      color: $text-muted;
    }

    &:focus {
      color: $text-primary;
    }
  }
}
</style>
