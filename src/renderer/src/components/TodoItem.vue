<script setup lang="ts">
import { ref, computed } from 'vue'
import { Task } from '../db'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'
import { useInlineEdit } from '../composables/useInlineEdit'
import SubTaskItem from './SubTaskItem.vue'
import SubTaskInput from './SubTaskInput.vue'
import IconCheck from './icons/IconCheck.vue'
import IconChevron from './icons/IconChevron.vue'
import IconTrash from './icons/IconTrash.vue'

const { confirm } = useConfirm()

const props = defineProps<{
  task: Task
}>()

// 是否已展开子任务
const isExpanded = computed(() => store.expandedTaskIds.has(props.task.id))

// 子任务列表
const subTasks = computed(() => store.subTasksMap[props.task.id] ?? [])

// 子任务进度：展开时从 subTasksMap 取实时数据，收起时从 SQL 统计字段取
const subTaskProgress = computed(() => {
  if (store.expandedTaskIds.has(props.task.id) && store.subTasksMap[props.task.id]) {
    const list = store.subTasksMap[props.task.id]
    if (list.length === 0) return null
    return { done: list.filter((t) => t.is_completed).length, total: list.length }
  }
  const total = props.task.subtask_total
  if (!total) return null
  return { done: props.task.subtask_done, total }
})

const handleToggle = () => store.toggleTask(props.task.id)
const handleToggleExpand = () => store.toggleExpand(props.task.id)

const handleDelete = async () => {
  const ok = await confirm('确认删除该任务吗？')
  if (ok) store.deleteTask(props.task.id)
}

const editInputRef = ref<HTMLTextAreaElement | null>(null)
const { isEditing, editContent, adjustHeight, handleDblClick, saveEdit, cancelEdit, onBlur } =
  useInlineEdit(
    editInputRef,
    () => props.task.content,
    (content) => store.updateTaskContent(props.task.id, content)
  )
</script>

<template>
  <div class="todo-item-wrapper">
    <!-- 主行 -->
    <div class="todo-item" :class="{ 'todo-item--completed': task.is_completed }">
      <!-- Checkbox -->
      <div class="todo-item__checkbox" @click="handleToggle">
        <IconCheck v-if="task.is_completed" class="todo-item__check-icon" />
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
          @blur="onBlur"
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

      <!-- 展开/收起按钮：hover 时始终可见，以便创建第一个子任务 -->
      <button
        v-if="!isEditing"
        class="todo-item__expand"
        :class="{ 'todo-item__expand--active': isExpanded }"
        @click="handleToggleExpand"
        title="展开子任务"
      >
        <IconChevron class="todo-item__expand-icon" />
      </button>

      <!-- Delete Button -->
      <button v-if="!isEditing" class="todo-item__delete" @click="handleDelete">
        <IconTrash class="todo-item__delete-icon" />
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
