<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { Task } from '../db'
import { store } from '../store'
import SubTaskItem from './SubTaskItem.vue'
import SubTaskInput from './SubTaskInput.vue'

const props = defineProps<{
  task: Task
}>()

// 编辑状态
const isEditing = ref(false)
const editContent = ref('')
const editInputRef = ref<HTMLTextAreaElement | null>(null)

// 是否已展开子任务
const isExpanded = computed(() => store.expandedTaskIds.has(props.task.id))

// 子任务列表
const subTasks = computed(() => store.subTasksMap[props.task.id] ?? [])

// 子任务进度：[已完成数, 总数]
const subTaskProgress = computed(() => {
  const list = subTasks.value
  if (list.length === 0) return null
  const done = list.filter((t) => t.is_completed).length
  return { done, total: list.length }
})

const handleToggle = () => {
  store.toggleTask(props.task.id)
}

const handleDelete = () => {
  store.deleteTask(props.task.id)
}

const handleToggleExpand = () => {
  store.toggleExpand(props.task.id)
}

// 自适应 textarea 高度
const adjustHeight = () => {
  const el = editInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

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
  <div class="todo-item-wrapper">
    <!-- 主行 -->
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
      <div v-else class="todo-item__content" @dblclick="handleDblClick">
        {{ task.content }}
        <!-- 子任务进度 badge -->
        <span v-if="subTaskProgress" class="todo-item__progress">
          {{ subTaskProgress.done }}/{{ subTaskProgress.total }}
        </span>
      </div>

      <!-- 展开/收起按钮 -->
      <button
        v-if="!isEditing"
        class="todo-item__expand"
        :class="{ 'todo-item__expand--active': isExpanded }"
        @click="handleToggleExpand"
        title="展开子任务"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="todo-item__expand-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M7.293 4.293a1 1 0 011.414 0L14 9.586l-5.293 5.293a1 1 0 01-1.414-1.414L11.586 9.5 7.293 5.207a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

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

    <!-- 子任务展开区域 -->
    <div v-if="isExpanded" class="todo-item__subtasks">
      <SubTaskItem v-for="sub in subTasks" :key="sub.id" :task="sub" :parentId="task.id" />
      <SubTaskInput :parentId="task.id" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-item-wrapper {
  border-bottom: 1px solid $border-color;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  transition: background-color $transition-fast;

  &:hover {
    background: $bg-hover;

    .todo-item__delete,
    .todo-item__expand {
      opacity: 1;
    }
  }

  &--completed {
    .todo-item__content {
      color: $text-muted;
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
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: $spacing-xs;
  }

  &__progress {
    font-size: $font-xs;
    color: $text-muted;
    background: rgba($border-color, 0.8);
    border-radius: 10px;
    padding: 0 5px;
    line-height: 1.6;
    flex-shrink: 0;
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

  // 展开按钮
  &__expand {
    flex-shrink: 0;
    opacity: 0;
    padding: $spacing-xs;
    background: transparent;
    border: none;
    color: $text-muted;
    cursor: pointer;
    transition: all $transition-fast;

    &--active {
      opacity: 1 !important;
      color: $accent-color;

      .todo-item__expand-icon {
        transform: rotate(90deg);
      }
    }

    &:hover {
      color: $accent-color;
    }
  }

  &__expand-icon {
    width: 12px;
    height: 12px;
    transition: transform $transition-fast;
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

  // 子任务展开区域
  &__subtasks {
    background: rgba($bg-secondary, 0.4);
    border-top: 1px dashed rgba($border-color, 0.6);
  }
}
</style>
