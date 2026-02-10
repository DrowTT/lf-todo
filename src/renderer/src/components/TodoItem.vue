<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Task } from '../db'
import { store } from '../store'

const props = defineProps<{
  task: Task
}>()

// 编辑状态
const isEditing = ref(false)
const editContent = ref('')
const editInputRef = ref<HTMLTextAreaElement | null>(null)

const handleToggle = () => {
  store.toggleTask(props.task.id)
}

const handleDelete = () => {
  store.deleteTask(props.task.id)
}

// 双击进入编辑模式
// 自适应 textarea 高度
const adjustHeight = () => {
  const el = editInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

const handleDblClick = () => {
  isEditing.value = true
  editContent.value = props.task.content
  nextTick(() => {
    adjustHeight()
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

// 保存编辑
const saveEdit = () => {
  const trimmed = editContent.value.trim()
  if (trimmed && trimmed !== props.task.content) {
    store.updateTaskContent(props.task.id, trimmed)
  }
  isEditing.value = false
}

// 取消编辑
const cancelEdit = () => {
  isEditing.value = false
  editContent.value = props.task.content
}
</script>

<template>
  <div class="todo-item" :class="{ 'todo-item--completed': task.is_completed }">
    <!-- Checkbox -->
    <div class="todo-item__checkbox" @click="handleToggle">
      <svg
        v-if="task.is_completed"
        xmlns="http://www.w3.org/2000/svg"
        class="todo-item__check-icon"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <!-- Content / Edit Input -->
    <div v-if="isEditing" class="todo-item__edit-wrapper">
      <textarea
        ref="editInputRef"
        v-model="editContent"
        class="todo-item__edit-input"
        maxlength="100"
        rows="1"
        @keydown.enter.exact.prevent="saveEdit"
        @keyup.escape="cancelEdit"
        @blur="saveEdit"
        @input="adjustHeight"
      />
    </div>
    <div v-else class="todo-item__content" @dblclick="handleDblClick">{{ task.content }}</div>

    <!-- Delete Button -->
    <button v-if="!isEditing" class="todo-item__delete" @click="handleDelete">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="todo-item__delete-icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  border-bottom: 1px solid $border-color;
  transition: background-color $transition-fast;

  &:hover {
    background: $bg-hover;

    .todo-item__delete {
      opacity: 1;
    }
  }

  &--completed {
    .todo-item__content {
      color: $text-muted;
      // 移除删除线效果
    }
  }

  &__checkbox {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    border: 1px solid $text-primary;
    border-radius: $radius-sm;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    transition: all $transition-fast;

    .todo-item--completed & {
      border-color: $text-muted;
    }
  }

  &__check-icon {
    width: 12px;
    height: 12px;
    color: $text-primary;

    .todo-item--completed & {
      color: $text-muted;
    }
  }

  &__content {
    flex: 1;
    font-size: $font-sm;
    color: $text-primary;
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
    font-size: $font-sm;
    line-height: 1.5;
    padding: 0 $spacing-xs;
    border: 1px solid $accent-color;
    border-radius: $radius-sm;
    outline: none;
    box-sizing: border-box;
    resize: none;
    overflow: hidden;
    font-family: inherit;
  }

  &__delete {
    flex-shrink: 0;
    opacity: 0;
    padding: $spacing-xs;
    background: transparent;
    border: none;
    color: $text-muted;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
      color: $danger-color;
    }
  }

  &__delete-icon {
    width: 14px;
    height: 14px;
  }
}
</style>
