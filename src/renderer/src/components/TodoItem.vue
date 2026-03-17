<script setup lang="ts">
import { ref, computed } from 'vue'
import { Task } from '../db'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'
import { useInlineEdit } from '../composables/useInlineEdit'
import SubTaskItem from './SubTaskItem.vue'
import SubTaskInput from './SubTaskInput.vue'
import { Check, ChevronRight, Trash2 } from 'lucide-vue-next'

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
  <div class="todo-item-wrapper" :class="{ 'todo-item-wrapper--expanded': isExpanded }">
    <!-- 主行 -->
    <div class="todo-item" :class="{ 'todo-item--completed': task.is_completed }">
      <!-- Checkbox -->
      <div class="todo-item__checkbox" @click="handleToggle">
        <Check v-if="task.is_completed" class="todo-item__check-icon" :size="12" />
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

      <!-- 展开/收起按钮 -->
      <button
        v-if="!isEditing"
        class="todo-item__expand"
        :class="{ 'todo-item__expand--active': isExpanded }"
        @click="handleToggleExpand"
        title="展开子任务"
      >
        <ChevronRight class="todo-item__expand-icon" :size="12" />
      </button>

      <!-- Delete Button -->
      <button v-if="!isEditing" class="todo-item__delete" @click="handleDelete">
        <Trash2 class="todo-item__delete-icon" :size="14" />
      </button>
    </div>

    <!-- 子任务展开区域（滑入动画） -->
    <Transition name="subtasks-slide">
      <div v-if="isExpanded" class="todo-item__subtasks">
        <SubTaskItem v-for="sub in subTasks" :key="sub.id" :task="sub" :parentId="task.id" />
        <SubTaskInput :parentId="task.id" />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-item-wrapper {
  // 始终保持透明边框预占位，避免展开时布局跳动
  border: 1px solid transparent;
  border-bottom-color: $border-subtle;
  border-radius: $radius-md;
  transition:
    border-color $transition-normal,
    background-color $transition-normal,
    box-shadow $transition-normal;

  // 展开子任务时，只变色不变尺寸
  &--expanded {
    background: $bg-elevated;
    border-color: $border-color;
    box-shadow: $shadow-sm;
  }
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-xl $spacing-md $spacing-lg;
  transition: background-color $transition-fast;
  position: relative;

  &:hover {
    background: $accent-soft;

    .todo-item__delete,
    .todo-item__expand {
      opacity: 1;
    }
  }

  &--completed {
    .todo-item__content {
      color: $text-muted;
      text-decoration: line-through;
      text-decoration-color: rgba($text-muted, 0.4);
    }

    .todo-item__checkbox {
      background: $accent-color;
      border-color: $accent-color;

      // 已完成状态 hover 应加深蓝色，而非变浅
      &:hover {
        background: darken($accent-color, 10%);
        border-color: darken($accent-color, 10%);
      }
    }

    .todo-item__check-icon {
      color: #FFFFFF;
    }
  }

  &__checkbox {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border: 1.5px solid $border-light;
    border-radius: $radius-sm;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    transition: all $transition-fast;

    &:hover {
      border-color: $accent-color;
      background: $accent-soft;
    }
  }

  &__check-icon {
    width: 12px;
    height: 12px;
  }

  &__content {
    flex: 1;
    font-size: $font-md;
    color: $text-primary;
    line-height: 1.6;
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
    color: $accent-color;
    background: $accent-soft;
    border-radius: 10px;
    padding: 1px 8px;
    line-height: 1.5;
    flex-shrink: 0;
    font-weight: 500;
  }

  &__edit-wrapper {
    flex: 1;
  }

  &__edit-input {
    width: 100%;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-md;
    line-height: 1.6;
    padding: 2px $spacing-sm;
    border: 1px solid $accent-color;
    border-radius: $radius-md;
    outline: none;
    box-sizing: border-box;
    resize: none;
    overflow: hidden;
    font-family: inherit;
    box-shadow: 0 0 0 3px $accent-soft;
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
    border-radius: $radius-sm;

    &--active {
      opacity: 1 !important;
      color: $accent-color;

      .todo-item__expand-icon {
        transform: rotate(90deg);
      }
    }

    &:hover {
      color: $accent-color;
      background: $accent-soft;
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
    border-radius: $radius-sm;

    &:hover {
      color: $danger-color;
      background: rgba($danger-color, 0.08);
    }
  }

  &__delete-icon {
    width: 14px;
    height: 14px;
  }

  // 子任务展开区域
  &__subtasks {
    padding: $spacing-xs 0 $spacing-xs $spacing-xl;
    margin: 0 $spacing-sm $spacing-xs;
    background: $bg-deep;
    border-top: 1px solid $border-color;
    border-radius: 0 0 $radius-sm $radius-sm;
    overflow: hidden;
  }
}

// 子任务区域滑入滑出动画
.subtasks-slide-enter-active {
  transition: all $transition-normal;
}

.subtasks-slide-leave-active {
  transition: all $transition-fast;
}

.subtasks-slide-enter-from,
.subtasks-slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
