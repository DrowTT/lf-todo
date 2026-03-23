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
  <div class="card" :class="{ 'card--open': isExpanded, 'card--done': task.is_completed }">
    <!-- 主行 -->
    <div class="card__row">
      <!-- 勾选框 -->
      <button class="card__check" :class="{ 'card__check--on': task.is_completed }" @click="handleToggle">
        <Check v-if="task.is_completed" class="card__check-svg" :size="12" />
      </button>

      <!-- 内容 / 编辑 -->
      <div v-if="isEditing" class="card__edit-wrap">
        <textarea
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
      </div>
      <div v-else class="card__text" @dblclick="handleDblClick">
        {{ task.content }}
        <!-- 子任务进度 -->
        <span v-if="subTaskProgress" class="card__progress">
          {{ subTaskProgress.done }}/{{ subTaskProgress.total }}
        </span>
      </div>

      <!-- 展开 -->
      <button
        v-if="!isEditing"
        class="card__action card__toggle"
        :class="{ 'card__toggle--on': isExpanded }"
        @click="handleToggleExpand"
        title="展开子任务"
      >
        <ChevronRight class="card__toggle-svg" :size="14" />
      </button>

      <!-- 删除 -->
      <button v-if="!isEditing" class="card__action card__del" @click="handleDelete">
        <Trash2 :size="14" />
      </button>
    </div>

    <!-- 子任务区域 -->
    <Transition name="sub-slide">
      <div v-if="isExpanded" class="card__subs">
        <SubTaskItem v-for="sub in subTasks" :key="sub.id" :task="sub" :parentId="task.id" />
        <SubTaskInput :parentId="task.id" />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

// ─── 卡片容器 ──────────────────────────────
.card {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  box-shadow:
    0 1px 3px rgba(15, 23, 42, 0.06),
    0 6px 16px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
  overflow: hidden;
  cursor: default;
  position: relative;

  // hover — 边框微调
  &:hover {
    border-color: #CBD5E1;
    box-shadow:
      0 1px 3px rgba(15, 23, 42, 0.06),
      0 6px 16px rgba(15, 23, 42, 0.04),
      inset 0 0 0 1px rgba(37, 99, 235, 0.04);
  }

  // 展开态 — 蓝色光晕（强调条不显示，已有边框）
  &--open {
    border-color: rgba(37, 99, 235, 0.3);
    box-shadow:
      0 2px 8px rgba(37, 99, 235, 0.08),
      0 0 0 1px rgba(37, 99, 235, 0.06);

    &:hover {
      border-color: rgba(37, 99, 235, 0.35);
    }
  }

  // 已完成态 — 降低存在感
  &--done {
    opacity: 0.7;
    &:hover { opacity: 1; }
  }
}

// ─── 主行 ──────────────────────────────────
.card__row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  transition: background-color 0.15s ease;

  &:hover {
    .card__action { opacity: 1; }
  }
}

// ─── 勾选框 ────────────────────────────────
.card__check {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border: 2px solid #CBD5E1;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  transition: all 0.2s ease;
  padding: 0;

  &:hover {
    border-color: #2563EB;
    background: rgba(37, 99, 235, 0.06);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
  }

  &--on {
    background: #2563EB;
    border-color: #2563EB;

    &:hover {
      background: #1D4ED8;
      border-color: #1D4ED8;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
    }
  }
}

.card__check-svg {
  color: #fff;
}

// ─── 文本 ──────────────────────────────────
.card__text {
  flex: 1;
  font-size: 14px;
  font-weight: 450;
  color: #0F172A;
  line-height: 1.65;
  word-break: break-word;
  user-select: text;
  cursor: text;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;

  .card--done & {
    color: #94A3B8;
    text-decoration: line-through;
    text-decoration-color: rgba(148, 163, 184, 0.4);
    font-weight: 400;
  }
}

// 子任务进度 badge
.card__progress {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: #2563EB;
  background: rgba(37, 99, 235, 0.08);
  border-radius: 100px;
  padding: 2px 10px;
  letter-spacing: 0.4px;
  line-height: 1.4;
  flex-shrink: 0;
}

// ─── 编辑态 ────────────────────────────────
.card__edit-wrap {
  flex: 1;
}

.card__edit-area {
  width: 100%;
  background: #fff;
  color: #0F172A;
  font-size: 14px;
  line-height: 1.65;
  padding: 4px 10px;
  border: 2px solid #2563EB;
  border-radius: 10px;
  outline: none;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

// ─── 操作按钮 ──────────────────────────────
.card__action {
  flex-shrink: 0;
  opacity: 0;
  padding: 4px;
  background: transparent;
  border: none;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 6px;
}

.card__toggle {
  &--on {
    opacity: 1 !important;
    color: #2563EB;
  }

  &:hover {
    color: #2563EB;
    background: rgba(37, 99, 235, 0.08);
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
    color: #DC2626;
    background: rgba(220, 38, 38, 0.08);
  }
}

// ─── 子任务展开区域 ────────────────────────
.card__subs {
  margin: 0 12px 12px;
  padding: 8px 4px 4px 14px;
  background: #F0F4FA;
  border-radius: 10px;
  border-left: 3px solid rgba(37, 99, 235, 0.25);
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
