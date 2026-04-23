<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { SendHorizonal } from 'lucide-vue-next'
import { SYSTEM_CATEGORY_NAME } from '../../../shared/constants/category'
import { DEFAULT_TASK_PRIORITY } from '../../../shared/constants/task'
import type { TaskDueState, TaskPriority } from '../../../shared/types/models'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAutoHeight } from '../composables/useAutoHeight'
import { useAppSessionStore } from '../store/appSession'
import TaskDueDatePicker from './TaskDueDatePicker.vue'
import TaskPriorityPicker from './TaskPriorityPicker.vue'
import { cloneTaskDueState, EMPTY_TASK_DUE_STATE } from '../utils/taskDue'

const app = useAppFacade()
const appSessionStore = useAppSessionStore()

const content = ref(appSessionStore.getTaskDraft(app.currentTaskScopeKey.value))
const dueState = ref(appSessionStore.getTaskDueDraft(app.currentTaskScopeKey.value))
const priority = ref<TaskPriority>(appSessionStore.getTaskPriorityDraft(app.currentTaskScopeKey.value))
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const { adjustHeight, resetHeight } = useAutoHeight(textareaRef)

const isAllTasksView = computed(() => app.isAllTasksView.value)
const placeholderText = computed(() =>
  isAllTasksView.value
    ? `这是聚合视图，直接输入后会先进入${SYSTEM_CATEGORY_NAME}`
    : '添加新的待办事项...'
)
const hasContent = computed(() => content.value.trim().length > 0)
const isSubmitting = computed(() => app.isLoading.value || app.taskStore.isCreatingTask)

const handleSubmit = async () => {
  if (!hasContent.value || isSubmitting.value) return

  const created = await app.addTask(content.value.trim(), {
    dueState: dueState.value,
    priority: priority.value
  })
  if (!created) return

  const scopeKey = app.currentTaskScopeKey.value
  content.value = ''
  dueState.value = cloneTaskDueState(EMPTY_TASK_DUE_STATE)
  priority.value = DEFAULT_TASK_PRIORITY
  appSessionStore.clearTaskDraft(scopeKey)
  appSessionStore.clearTaskDueDraft(scopeKey)
  appSessionStore.clearTaskPriorityDraft(scopeKey)
  nextTick(resetHeight)
}

const handleDueApply = (value: TaskDueState) => {
  dueState.value = cloneTaskDueState(value)
}

const handlePriorityApply = (value: TaskPriority) => {
  priority.value = value
}

watch(
  () => app.currentTaskScopeKey.value,
  (scopeKey) => {
    content.value = appSessionStore.getTaskDraft(scopeKey)
    dueState.value = appSessionStore.getTaskDueDraft(scopeKey)
    priority.value = appSessionStore.getTaskPriorityDraft(scopeKey)
    nextTick(adjustHeight)
  },
  { immediate: true }
)

watch(content, (value) => {
  appSessionStore.setTaskDraft(app.currentTaskScopeKey.value, value)
})

watch(
  dueState,
  (value) => {
    appSessionStore.setTaskDueDraft(app.currentTaskScopeKey.value, value)
  },
  { deep: true }
)

watch(priority, (value) => {
  appSessionStore.setTaskPriorityDraft(app.currentTaskScopeKey.value, value)
})
</script>

<template>
  <div class="todo-input">
    <div class="todo-input__wrapper">
      <textarea
        ref="textareaRef"
        v-model="content"
        rows="1"
        class="todo-input__field"
        :placeholder="placeholderText"
        maxlength="100"
        :disabled="isSubmitting"
        @input="adjustHeight"
        @keydown.enter.exact.prevent="handleSubmit"
        @keyup.escape="($event.target as HTMLTextAreaElement).blur()"
      />
      <div class="todo-input__controls">
        <div class="todo-input__priority-slot">
          <TaskPriorityPicker
            :priority="priority"
            :disabled="isSubmitting"
            @apply="handlePriorityApply"
          />
        </div>
        <TaskDueDatePicker
          :due-state="dueState"
          variant="input"
          align="right"
          empty-label="截止日期"
          :disabled="isSubmitting"
          @apply="handleDueApply"
        />
        <button
          class="todo-input__btn"
          :class="{ 'todo-input__btn--active': hasContent && !isSubmitting }"
          :disabled="!hasContent || isSubmitting"
          @click="handleSubmit"
        >
          <SendHorizonal :size="18" />
        </button>
      </div>
    </div>
    <p v-if="isAllTasksView" class="todo-input__hint">
      {{ `“全部”只是聚合浏览视图，这里新建的任务会先进入${SYSTEM_CATEGORY_NAME}，再出现在全部列表中。` }}
    </p>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-input {
  padding: $spacing-md $spacing-xl;

  &__hint {
    margin: 8px 2px 0;
    font-size: $font-xs;
    color: $text-muted;
  }

  &__wrapper {
    display: flex;
    align-items: stretch;
    border: 1px solid $border-light;
    border-radius: $radius-lg;
    background: $bg-input;
    transition: all $transition-normal;
    overflow: hidden;

    &:focus-within {
      border-color: $accent-color;
      box-shadow:
        0 0 0 3px $accent-soft,
        $shadow-glow;
      background: rgba($bg-input, 0.8);
    }
  }

  &__field {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: $text-primary;
    font-size: $font-md;
    padding: $spacing-md $spacing-lg;
    border: none;
    border-radius: 0;
    outline: none;
    resize: none;
    overflow: hidden;
    font-family: inherit;
    line-height: 1.5;

    &::placeholder {
      color: $text-muted;
    }

    &:disabled {
      opacity: 0.5;
    }
  }

  &__controls {
    display: flex;
    align-items: stretch;
    flex-shrink: 0;
  }

  &__priority-slot {
    display: flex;
    align-items: center;
    padding: 0 10px 0 12px;
    border-left: 1px solid $border-color;
    flex-shrink: 0;
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    flex-shrink: 0;
    border: none;
    border-left: 1px solid $border-color;
    background: transparent;
    color: $text-muted;
    cursor: not-allowed;
    transition: all $transition-normal;

    &--active {
      background: $accent-color;
      color: #fff;
      cursor: pointer;

      &:hover {
        background: $accent-hover;
      }

      &:active svg {
        transform: scale(0.82);
      }
    }

    svg {
      transition: transform $transition-fast;
    }

    &:disabled:not(.todo-input__btn--active) {
      opacity: 0.4;
    }
  }
}
</style>
