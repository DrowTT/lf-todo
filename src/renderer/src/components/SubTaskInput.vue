<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { store } from '../store'
import { useAutoHeight } from '../composables/useAutoHeight'

const props = defineProps<{
  parentId: number
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const content = ref('')

// 提交子任务
const handleSubmit = async () => {
  const trimmed = content.value.trim()
  if (!trimmed) return
  await store.addSubTask(trimmed, props.parentId)
  content.value = ''
  nextTick(resetHeight)
  textareaRef.value?.focus()
}

const { adjustHeight, resetHeight } = useAutoHeight(textareaRef)

// 挂载时同步初始化高度
onMounted(() => adjustHeight())
</script>

<template>
  <div class="subtask-input">
    <span class="subtask-input__icon">+</span>
    <textarea
      ref="textareaRef"
      rows="1"
      v-model="content"
      class="subtask-input__field"
      placeholder="添加子任务…"
      maxlength="200"
      @input="adjustHeight"
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
  padding: $spacing-xs $spacing-md $spacing-xs $spacing-sm;

  &__icon {
    flex-shrink: 0;
    font-size: $font-md;
    color: $text-muted;
    line-height: 1;
    user-select: none;
    width: 14px;
    text-align: center;
  }

  &__field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    color: $text-secondary;
    font-size: $font-xs;
    font-family: inherit;
    padding: 0;
    line-height: 1.5;
    transition: color $transition-fast;

    &::placeholder {
      color: $text-muted;
    }

    &:focus {
      color: $text-primary;
    }
  }
}
</style>
