<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '../../../shared/types/models'
import { useAppFacade } from '../app/facade/useAppFacade'
// lucide-vue-next 中无专用番茄图标，改用 Timer 代替 Clock3 以区分
import { useAppRuntime } from '../app/runtime'
import { useHoverTarget } from '../composables/useHoverTarget'
import { useInlineEdit } from '../composables/useInlineEdit'
import { useAppSessionStore } from '../store/appSession'
import { usePomodoroStore } from '../store/pomodoro'
import { useSubTaskStore } from '../store/subtask'
import { useTaskStore } from '../store/task'
import SubTaskInput from './SubTaskInput.vue'
import SubTaskItem from './SubTaskItem.vue'
import { Check, ChevronRight, GripVertical, Play, Timer, Trash2 } from 'lucide-vue-next'

const app = useAppFacade()
const runtime = useAppRuntime()
const { confirm } = runtime.confirm
const { setHoverTask, clearHover } = useHoverTarget()
const appSessionStore = useAppSessionStore()
const pomodoroStore = usePomodoroStore()
const taskStore = useTaskStore()
const subTaskStore = useSubTaskStore()

const props = defineProps<{
  task: Task
}>()

const isExpanded = computed(() => subTaskStore.expandedTaskIds.has(props.task.id))
const subTasks = computed(() => subTaskStore.subTasksMap[props.task.id] ?? [])
const isDeleting = computed(() => taskStore.isTaskDeleting(props.task.id))
const isSaving = computed(() => taskStore.isTaskSaving(props.task.id))
const isBusy = computed(() => taskStore.isTaskBusy(props.task.id))
const pomodoroCount = computed(() => pomodoroStore.getTaskPomodoroCount(props.task.id))
const isPomodoroRunningForTask = computed(
  () => pomodoroStore.activeSession?.taskId === props.task.id
)
const isPomodoroBusy = computed(() => pomodoroStore.isBusy)

const subTaskProgress = computed(() => {
  if (isExpanded.value && subTasks.value.length > 0) {
    const done = subTasks.value.filter((subTask) => subTask.is_completed).length
    return {
      done,
      total: subTasks.value.length
    }
  }

  if (!props.task.subtask_total) {
    return null
  }

  return {
    done: props.task.subtask_done,
    total: props.task.subtask_total
  }
})

const handleToggle = () => {
  void taskStore.toggleTask(props.task.id, props.task.category_id)
}

const handleToggleExpand = () => {
  void subTaskStore.toggleExpand(props.task.id, props.task.category_id)
}

const handleDelete = async () => {
  const ok = await confirm('确认删除该任务吗？')
  if (ok) {
    await app.deleteTask(props.task.id)
  }
}

const handleStartPomodoro = async () => {
  if (typeof pomodoroStore.startForTask !== 'function') {
    runtime.toast.show('番茄钟模块已更新，请刷新页面后重试。', 'info')
    return
  }

  const started = await pomodoroStore.startForTask(props.task)
  if (started) {
    appSessionStore.setCurrentMainView('pomodoro')
  }
}

const editInputRef = ref<HTMLTextAreaElement | null>(null)
const { isEditing, editContent, adjustHeight, handleDblClick, saveEdit, cancelEdit, onBlur } =
  useInlineEdit(
    editInputRef,
    () => props.task.content,
    (content) => {
      void taskStore.updateTaskContent(props.task.id, content)
    }
  )

const onCardMouseEnter = () => setHoverTask(props.task.id)
const onCardMouseLeave = () => clearHover()
</script>

<template>
  <div
    class="card"
    :class="{ 'card--open': isExpanded, 'card--done': task.is_completed, 'card--busy': isBusy }"
    :data-task-id="task.id"
    @mouseenter="onCardMouseEnter"
    @mouseleave="onCardMouseLeave"
  >
    <div class="card__row">
      <div class="card__drag-handle">
        <GripVertical :size="14" />
      </div>

      <button
        class="card__check"
        :class="{ 'card__check--on': task.is_completed }"
        :disabled="isBusy"
        @click="handleToggle"
      >
        <Check v-if="task.is_completed" class="card__check-svg" :size="12" />
      </button>

      <textarea
        v-if="isEditing"
        ref="editInputRef"
        v-model="editContent"
        class="card__edit-area"
        maxlength="100"
        rows="1"
        @keydown.enter.exact.prevent="saveEdit"
        @keyup.escape="cancelEdit"
        @blur="onBlur"
        @input="adjustHeight"
      />
      <div v-else class="card__text" @dblclick="handleDblClick">
        {{ task.content }}
        <span v-if="subTaskProgress" class="card__progress">
          {{ subTaskProgress.done }}/{{ subTaskProgress.total }}
        </span>
        <span v-if="isSaving" class="card__status">保存中</span>
        <span v-else-if="isDeleting" class="card__status card__status--danger">删除中</span>
      </div>

      <span
        v-if="pomodoroCount > 0"
        class="card__pomodoro-badge"
        :title="`已完成 ${pomodoroCount} 个番茄`"
      >
        <Timer class="card__pomodoro-badge-icon" :size="11" />
        <span class="card__pomodoro-badge-count">{{ pomodoroCount }}</span>
      </span>

      <button
        class="card__action card__pomodoro-btn"
        :class="{
          'card__pomodoro-btn--active': isPomodoroRunningForTask,
          'card__action--hidden': isEditing
        }"
        :disabled="isBusy || isPomodoroBusy"
        :title="isPomodoroRunningForTask ? '该待办番茄钟进行中' : '开始番茄钟'"
        @click="handleStartPomodoro"
      >
        <Play :size="14" />
      </button>

      <button
        class="card__action card__toggle"
        :class="{ 'card__toggle--on': isExpanded, 'card__action--hidden': isEditing }"
        :disabled="isBusy"
        title="展开子任务"
        @click="handleToggleExpand"
      >
        <ChevronRight class="card__toggle-svg" :size="14" />
      </button>

      <button
        class="card__action card__del"
        :class="{ 'card__action--hidden': isEditing }"
        :disabled="isBusy"
        @click="handleDelete"
      >
        <Trash2 :size="14" />
      </button>
    </div>

    <Transition name="sub-slide">
      <div v-if="isExpanded" class="card__subs">
        <SubTaskItem v-for="sub in subTasks" :key="sub.id" :task="sub" :parent-id="task.id" />
        <SubTaskInput :parent-id="task.id" />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.card {
  background: $bg-elevated;
  border: 1px solid $border-color;
  border-radius: 14px;
  box-shadow:
    0 1px 3px rgba(15, 23, 42, 0.06),
    0 6px 16px rgba(15, 23, 42, 0.04);
  transition:
    box-shadow 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease,
    opacity 0.25s ease;
  overflow: hidden;
  cursor: default;
  position: relative;

  &:hover {
    border-color: $border-light;
    box-shadow:
      0 2px 6px rgba(15, 23, 42, 0.08),
      0 8px 20px rgba(15, 23, 42, 0.06);
  }

  &--open {
    border-color: rgba($accent-color, 0.3);
    box-shadow:
      0 2px 8px rgba($accent-color, 0.08),
      0 0 0 1px rgba($accent-color, 0.06);

    &:hover {
      border-color: rgba($accent-color, 0.35);
      transform: none;
    }
  }

  &--done {
    opacity: 0.65;
    background: rgba($bg-elevated, 0.7);

    &:hover {
      opacity: 0.9;
    }
  }

  &--busy {
    opacity: 0.82;
  }
}

.card__drag-handle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 22px;
  margin-top: 1px;
  color: $text-muted;
  opacity: 0;
  cursor: grab;
  transition: all $transition-normal;
  border-radius: $radius-sm;
  margin-left: -4px;

  &:hover {
    color: $accent-color;
    opacity: 1 !important;
  }

  &:active {
    cursor: grabbing;
  }
}

.card:hover .card__drag-handle {
  opacity: 0.45;
}

.card--dragging {
  opacity: 0.92;
  transform: rotate(1.5deg) scale(1.02);
  box-shadow:
    0 8px 28px rgba(37, 99, 235, 0.12),
    0 0 0 2px rgba($accent-color, 0.25);
  border-color: rgba($accent-color, 0.4);
  z-index: 10;
  transition: none;

  .card__drag-handle {
    opacity: 1 !important;
    color: $accent-color;
    cursor: grabbing;
  }
}

.card--ghost {
  opacity: 0.35;
  transform: scale(0.98);
  border: 2px dashed rgba($accent-color, 0.35);
  box-shadow: none;
  background: rgba($accent-color, 0.03);
}

.card__row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  transition: background-color 0.15s ease;

  &:hover {
    .card__action {
      opacity: 1;
    }
  }
}

.card__check {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border: 2px solid $border-light;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-elevated;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  padding: 0;

  &:hover:not(:disabled) {
    border-color: $accent-color;
    background: $accent-soft;
    box-shadow: 0 0 0 4px rgba($accent-color, 0.08);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &--on {
    background: $accent-color;
    border-color: $accent-color;
    animation: check-bounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

    &:hover:not(:disabled) {
      background: $accent-hover;
      border-color: $accent-hover;
      box-shadow: 0 0 0 4px rgba($accent-color, 0.12);
    }
  }
}

@keyframes check-bounce {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.card__check-svg {
  color: #fff;
}

.card__text {
  flex: 1;
  font-size: $font-lg;
  font-weight: 450;
  color: $text-primary;
  line-height: 1.65;
  word-break: break-word;
  user-select: text;
  cursor: text;
  white-space: pre-line;

  .card--done & {
    color: $text-muted;
    text-decoration: line-through;
    text-decoration-color: rgba($text-muted, 0.4);
    font-weight: 400;
  }
}

.card__progress {
  display: inline-flex;
  align-items: center;
  font-size: $font-xs;
  font-weight: 600;
  color: $accent-color;
  background: $accent-soft;
  border-radius: 100px;
  padding: 2px 10px;
  letter-spacing: 0.4px;
  line-height: 1.4;
  flex-shrink: 0;
  margin-left: 6px;
}

/* 番茄计数徽章 — 使用橙红色，与子任务进度的蓝色 pill 明确区分 */
.card__pomodoro-badge {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  gap: 4px;
  height: 22px;
  font-size: $font-xs;
  font-weight: 600;
  color: #c2410c;
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.94), rgba(255, 247, 237, 0.98));
  border: 1px solid rgba(249, 115, 22, 0.14);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    0 1px 2px rgba(15, 23, 42, 0.04);
  padding: 0 7px;
  letter-spacing: 0.25px;
  line-height: 1;
  flex-shrink: 0;
}

.card__pomodoro-badge-icon {
  color: #f97316;
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  opacity: 0.9;
}

.card__pomodoro-badge-count {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  min-width: 9px;
  transform: translateY(0.25px);
}

.card__status {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  font-size: $font-xs;
  color: $text-muted;

  &--danger {
    color: $danger-color;
  }
}

.card__edit-area {
  flex: 1;
  background: transparent;
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 450;
  line-height: 1.65;
  padding: 0;
  margin: 0;
  display: block;
  border: none;
  border-radius: 0;
  box-shadow: 0 1.5px 0 0 rgba($accent-color, 0.4);
  outline: none;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  font-family: inherit;
}

.card__action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  padding: 4px;
  background: transparent;
  border: none;
  color: $text-muted;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 6px;
  line-height: 0;
  vertical-align: middle;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  &--hidden {
    visibility: hidden;
    pointer-events: none;
  }
}

.card__toggle {
  &--on {
    opacity: 1 !important;
    color: $accent-color;
  }

  &:hover:not(:disabled) {
    color: $accent-color;
    background: $accent-soft;
  }
}

/* 番茄钟播放按钮 — 微型圆形强调按钮，始终微可见 */
.card__pomodoro-btn {
  color: $text-muted;

  &:hover:not(:disabled) {
    color: $accent-color;
    background: $accent-soft;
  }

  &:disabled {
    opacity: 0.4;
  }

  /* 运行态 — 显示脉冲光圈 */
  &--active {
    opacity: 1 !important;
    color: $success-color;
    background: rgba($success-color, 0.1);
    animation: pomo-pulse 2s ease-in-out infinite;

    &:hover:not(:disabled) {
      color: $success-color;
      background: rgba($success-color, 0.15);
    }
  }
}

@keyframes pomo-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba($success-color, 0.2);
  }
  50% {
    box-shadow: 0 0 0 5px rgba($success-color, 0);
  }
}

.card__toggle-svg {
  display: block;
  transition: transform 0.2s ease;

  .card__toggle--on & {
    transform: rotate(90deg);
  }
}

.card__del {
  &:hover:not(:disabled) {
    color: $danger-color;
    background: rgba($danger-color, 0.08);
  }
}

.card__subs {
  margin: 0 12px 12px;
  padding: 8px 4px 4px 14px;
  background: $bg-deep;
  border-radius: 10px;
  border-left: 3px solid rgba($accent-color, 0.25);
  overflow: hidden;
}

.sub-slide-enter-active {
  transition: all 0.25s ease;
}

.sub-slide-leave-active {
  transition: all 0.15s ease;
}

.sub-slide-enter-from,
.sub-slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
