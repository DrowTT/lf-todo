<script setup lang="ts">
import { ref } from 'vue'
import { Task } from '../db'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'
import { useInlineEdit } from '../composables/useInlineEdit'
import { Check, X } from 'lucide-vue-next'

const { confirm } = useConfirm()

const props = defineProps<{
  task: Task
  parentId: number
}>()

const handleToggle = () => store.toggleSubTask(props.task.id, props.parentId)

const handleDelete = async () => {
  const ok = await confirm('确认删除该子任务吗？')
  if (ok) store.deleteSubTask(props.task.id, props.parentId)
}

const editInputRef = ref<HTMLTextAreaElement | null>(null)
const { isEditing, editContent, adjustHeight, handleDblClick, saveEdit, cancelEdit, onBlur } =
  useInlineEdit(
    editInputRef,
    () => props.task.content,
    (content) => store.updateSubTaskContent(props.task.id, props.parentId, content)
  )
</script>

<template>
  <div class="subtask-item" :class="{ 'subtask-item--completed': task.is_completed }">
    <!-- Checkbox -->
    <div class="subtask-item__checkbox" @click="handleToggle">
      <Check v-if="task.is_completed" class="subtask-item__check-icon" :size="9" />
    </div>

    <!-- Content / Edit Input -->
    <div v-if="isEditing" class="subtask-item__edit-wrapper">
      <textarea
        ref="editInputRef"
        v-model="editContent"
        class="subtask-item__edit-input"
        maxlength="200"
        rows="1"
        @keydown.enter.exact.prevent="saveEdit"
        @keyup.escape="cancelEdit"
        @blur="onBlur"
        @input="adjustHeight"
      />
    </div>
    <div v-else class="subtask-item__content" @dblclick="handleDblClick">{{ task.content }}</div>

    <!-- Delete Button -->
    <button v-if="!isEditing" class="subtask-item__delete" @click="handleDelete">
      <X class="subtask-item__delete-icon" :size="11" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.subtask-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-md $spacing-xs $spacing-sm;
  transition: background-color $transition-fast;

  &:hover {
    background: $accent-soft;

    .subtask-item__delete {
      opacity: 1;
    }
  }

  &--completed {
    .subtask-item__content {
      color: $text-muted;
      text-decoration: line-through;
      text-decoration-color: rgba($text-muted, 0.3);
    }

    .subtask-item__checkbox {
      background: $text-muted;
      border-color: $text-muted;

      // 已完成状态 hover 应加深颜色
      &:hover {
        background: darken($text-muted, 12%);
        border-color: darken($text-muted, 12%);
      }
    }

    .subtask-item__check-icon {
      color: #FFFFFF;
    }
  }

  &__checkbox {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    margin-top: 2px;
    border: 1.5px solid $border-light;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    transition: all $transition-fast;

    &:hover {
      border-color: $accent-color;
    }
  }

  &__check-icon {
    width: 9px;
    height: 9px;
  }

  &__content {
    flex: 1;
    font-size: $font-xs;
    color: $text-secondary;
    line-height: 1.5;
    word-break: break-word;
    user-select: text;
    cursor: text;
  }

  &__edit-wrapper {
    flex: 1;
  }

  &__edit-input {
    width: 100%;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-xs;
    line-height: 1.5;
    padding: 1px $spacing-sm;
    border: 1px solid $accent-color;
    border-radius: $radius-sm;
    outline: none;
    box-sizing: border-box;
    resize: none;
    overflow: hidden;
    font-family: inherit;
    box-shadow: 0 0 0 2px $accent-soft;
  }

  &__delete {
    flex-shrink: 0;
    opacity: 0;
    padding: 2px;
    background: transparent;
    border: none;
    color: $text-muted;
    cursor: pointer;
    transition: all $transition-fast;
    border-radius: $radius-sm;

    &:hover {
      color: $danger-color;
      background: rgba($danger-color, 0.08);
    }
  }

  &__delete-icon {
    width: 11px;
    height: 11px;
  }
}
</style>
