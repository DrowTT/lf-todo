<script setup lang="ts">
import { ref, computed } from 'vue'
import { Task } from '../db'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'
import { useInlineEdit } from '../composables/useInlineEdit'
import { useHoverTarget } from '../composables/useHoverTarget'
import { useAuthStore } from '../store/auth'
import SubTaskItem from './SubTaskItem.vue'
import SubTaskInput from './SubTaskInput.vue'
import { Check, ChevronRight, GripVertical, Trash2 } from 'lucide-vue-next'

const authStore = useAuthStore()

const { confirm } = useConfirm()
const { setHoverTask, clearHover } = useHoverTarget()

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
    const done = list.filter((t) => t.is_completed).length
    const total = list.length
    // 回写 SQL 缓存字段，确保收起后数据一致
    props.task.subtask_done = done
    props.task.subtask_total = total
    return { done, total }
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

// 鼠标进入卡片时设置悬停目标
const onCardMouseEnter = () => setHoverTask(props.task.id)
// 鼠标离开卡片时清除悬停目标
const onCardMouseLeave = () => clearHover()
</script>

<template>
  <div
    class="card"
    :class="{ 'card--open': isExpanded, 'card--done': task.is_completed }"
    :data-task-id="task.id"
    @mouseenter="onCardMouseEnter"
    @mouseleave="onCardMouseLeave"
  >
    <!-- 主行 -->
    <div class="card__row">
      <!-- 拖拽手柄 -->
      <div class="card__drag-handle">
        <GripVertical :size="14" />
      </div>

      <!-- 勾选框 -->
      <button
        class="card__check"
        :class="{ 'card__check--on': task.is_completed }"
        @click="handleToggle"
      >
        <Check v-if="task.is_completed" class="card__check-svg" :size="12" />
      </button>

      <!-- 内容 / 编辑 -->
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
        <!-- 子任务进度 -->
        <span v-if="subTaskProgress" class="card__progress">
          {{ subTaskProgress.done }}/{{ subTaskProgress.total }}
        </span>
      </div>

      <!-- 子任务展开/收起按钮（仅 Pro 用户可见） -->
      <button
        v-if="authStore.isPro"
        class="card__action card__toggle"
        :class="{ 'card__toggle--on': isExpanded, 'card__action--hidden': isEditing }"
        title="展开子任务"
        @click="handleToggleExpand"
      >
        <ChevronRight class="card__toggle-svg" :size="14" />
      </button>

      <button class="card__action card__del" :class="{ 'card__action--hidden': isEditing }" @click="handleDelete">
        <Trash2 :size="14" />
      </button>
    </div>

    <!-- 子任务区域（仅 Pro 用户可见） -->
    <Transition name="sub-slide">
      <div v-if="authStore.isPro && isExpanded" class="card__subs">
        <SubTaskItem v-for="sub in subTasks" :key="sub.id" :task="sub" :parent-id="task.id" />
        <SubTaskInput :parent-id="task.id" />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

// ─── 卡片容器 ──────────────────────────────
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

  // hover — 微妙上浮 + 边框调整
  &:hover {
    border-color: $border-light;
    transform: translateY(-1px);
    box-shadow:
      0 2px 6px rgba(15, 23, 42, 0.08),
      0 8px 20px rgba(15, 23, 42, 0.06);
  }

  // 展开态 — 蓝色光晕
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

  // 已完成态 — 柔化视觉
  &--done {
    opacity: 0.65;
    background: rgba($bg-elevated, 0.7);

    &:hover {
      opacity: 0.9;
    }
  }
}

// ─── 拖拽手柄 ──────────────────────────────
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

// 卡片 hover 时显示拖拽手柄
.card:hover .card__drag-handle {
  opacity: 0.45;
}

// ─── 拖拽态 ─────────────────────────────────
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

// ─── 拖拽占位元素（SortableJS ghost） ──────
.card--ghost {
  opacity: 0.35;
  transform: scale(0.98);
  border: 2px dashed rgba($accent-color, 0.35);
  box-shadow: none;
  background: rgba($accent-color, 0.03);
}

// ─── 主行 ──────────────────────────────────
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

// ─── 勾选框 ────────────────────────────────
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

  &:hover {
    border-color: $accent-color;
    background: $accent-soft;
    box-shadow: 0 0 0 4px rgba($accent-color, 0.08);
  }

  // 勾选态 — 带微弹跳
  &--on {
    background: $accent-color;
    border-color: $accent-color;
    animation: check-bounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

    &:hover {
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

// ─── 文本 ──────────────────────────────────
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

// 子任务进度 badge
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

// ─── 编辑态 ────────────────────────────────

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

// ─── 操作按钮 ──────────────────────────────
.card__action {
  flex-shrink: 0;
  opacity: 0;
  padding: 4px;
  background: transparent;
  border: none;
  color: $text-muted;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 6px;

  // 编辑态隐藏但保留占位，防止行高坍缩
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

  &:hover {
    color: $accent-color;
    background: $accent-soft;
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
  &:hover {
    color: $danger-color;
    background: rgba($danger-color, 0.08);
  }
}

// ─── 子任务展开区域 ────────────────────────
.card__subs {
  margin: 0 12px 12px;
  padding: 8px 4px 4px 14px;
  background: $bg-deep;
  border-radius: 10px;
  border-left: 3px solid rgba($accent-color, 0.25);
  overflow: hidden;
}

// ─── 子任务滑入/滑出动画 ──────────────────
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
