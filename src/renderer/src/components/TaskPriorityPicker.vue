<script setup lang="ts">
import { computed } from 'vue'
import type { TaskPriority } from '../../../shared/types/models'
import {
  getNextTaskPriority,
  getTaskPriorityCode,
  getTaskPriorityTitle
} from '../utils/taskPriority'

const props = withDefaults(
  defineProps<{
    priority: TaskPriority
    disabled?: boolean
  }>(),
  {
    disabled: false
  }
)

const emit = defineEmits<{
  apply: [value: TaskPriority]
}>()

const currentCode = computed(() => getTaskPriorityCode(props.priority))
const currentTitle = computed(() => getTaskPriorityTitle(props.priority))
const nextPriority = computed(() => getNextTaskPriority(props.priority))
const triggerTitle = computed(() => {
  const nextCode = getTaskPriorityCode(nextPriority.value)
  const nextTitle = getTaskPriorityTitle(nextPriority.value)

  return `${currentCode.value} ${currentTitle.value}，点击切换为 ${nextCode} ${nextTitle}`
})

function handleClick() {
  if (props.disabled) {
    return
  }

  emit('apply', nextPriority.value)
}
</script>

<template>
  <button
    type="button"
    class="priority-trigger"
    :class="`priority-trigger--${priority}`"
    :disabled="disabled"
    :title="triggerTitle"
    :aria-label="triggerTitle"
    @click="handleClick"
  >
    <span class="priority-trigger__accent" aria-hidden="true"></span>
    <span class="priority-trigger__code">{{ currentCode }}</span>
  </button>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.priority-trigger {
  --priority-text: rgba(240, 145, 56, 0.72);
  --priority-soft: rgba(240, 145, 56, 0.05);
  --priority-soft-hover: rgba(240, 145, 56, 0.08);
  --priority-border: rgba(240, 145, 56, 0.1);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 54px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--priority-text);
  cursor: pointer;
  font-family: inherit;
  transition:
    background-color $transition-fast,
    color $transition-fast,
    border-color $transition-fast,
    opacity $transition-fast,
    box-shadow $transition-fast;

  &:hover:not(:disabled) {
    background: var(--priority-soft);
    border-color: var(--priority-border);
  }

  &:focus-visible {
    outline: none;
    background: var(--priority-soft-hover);
    border-color: var(--priority-border);
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.05);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &--high {
    --priority-text: rgba(215, 104, 104, 0.78);
    --priority-soft: rgba(215, 104, 104, 0.06);
    --priority-soft-hover: rgba(215, 104, 104, 0.1);
    --priority-border: rgba(215, 104, 104, 0.12);
  }

  &--medium {
    --priority-text: rgba(240, 145, 56, 0.72);
    --priority-soft: rgba(240, 145, 56, 0.05);
    --priority-soft-hover: rgba(240, 145, 56, 0.08);
    --priority-border: rgba(240, 145, 56, 0.1);
  }

  &--low {
    --priority-text: rgba(111, 146, 211, 0.78);
    --priority-soft: rgba(111, 146, 211, 0.06);
    --priority-soft-hover: rgba(111, 146, 211, 0.1);
    --priority-border: rgba(111, 146, 211, 0.12);
  }
}

.priority-trigger__accent {
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.78;
}

.priority-trigger__code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: $font-xs;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  transform: translateY(-0.25px);
}
</style>
