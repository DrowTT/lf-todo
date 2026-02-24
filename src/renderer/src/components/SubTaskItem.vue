<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Task } from '../db'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'
import { useAutoHeight } from '../composables/useAutoHeight'

const { confirm } = useConfirm()

const props = defineProps<{
  task: Task
  parentId: number
}>()

// 编辑状态
const isEditing = ref(false)
const editContent = ref('')
const editInputRef = ref<HTMLTextAreaElement | null>(null)

const handleToggle = () => {
  store.toggleSubTask(props.task.id, props.parentId)
}

const handleDelete = async () => {
  // UX1：子任务删除也需确认
  const ok = await confirm('确认删除该子任务吗？')
  if (ok) store.deleteSubTask(props.task.id, props.parentId)
}

const { adjustHeight } = useAutoHeight(editInputRef)

// 双击进入编辑模式
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
    store.updateSubTaskContent(props.task.id, props.parentId, trimmed)
  }
  isEditing.value = false
}

// UX4：blur 时内容未变化则直接取消，不触发 IPC
const onBlur = () => {
  const trimmed = editContent.value.trim()
  if (!trimmed || trimmed === props.task.content) {
    cancelEdit()
  } else {
    saveEdit()
  }
}

// 取消编辑
const cancelEdit = () => {
  isEditing.value = false
  editContent.value = props.task.content
}
</script>

<template>
  <div class="subtask-item" :class="{ 'subtask-item--completed': task.is_completed }">
    <!-- Checkbox -->
    <div class="subtask-item__checkbox" @click="handleToggle">
      <svg
        v-if="task.is_completed"
        xmlns="http://www.w3.org/2000/svg"
        class="subtask-item__check-icon"
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="subtask-item__delete-icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.subtask-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-xs;
  padding: 4px $spacing-sm 4px 28px; // 左侧缩进 28px 形成层级感
  border-bottom: 1px solid rgba($border-color, 0.6);
  transition: background-color $transition-fast;

  &:hover {
    background: rgba($bg-hover, 0.5);

    .subtask-item__delete {
      opacity: 1;
    }
  }

  &--completed {
    .subtask-item__content {
      color: $text-muted;
    }
  }

  &__checkbox {
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    margin-top: 2px;
    border: 1px solid $text-secondary;
    border-radius: $radius-sm;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    transition: all $transition-fast;

    .subtask-item--completed & {
      border-color: $text-muted;
    }
  }

  &__check-icon {
    width: 9px;
    height: 9px;
    color: $text-secondary;

    .subtask-item--completed & {
      color: $text-muted;
    }
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
    padding: 2px;
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
    width: 11px;
    height: 11px;
  }
}
</style>
