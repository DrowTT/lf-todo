<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'
import { useHoverTarget } from '../composables/useHoverTarget'
import { useInlineEdit } from '../composables/useInlineEdit'
import { useSubTaskStore } from '../store/subtask'
import { Check, GripVertical, X } from 'lucide-vue-next'

const { confirm } = useAppRuntime().confirm
const { setHoverSubTask, setHoverTask } = useHoverTarget()
const subTaskStore = useSubTaskStore()

const props = defineProps<{
  task: Task
  parentId: number
  reordering?: boolean
}>()

const isDeleting = computed(() => subTaskStore.isSubTaskDeleting(props.task.id))
const isSaving = computed(() => subTaskStore.isSubTaskSaving(props.task.id))
const isBusy = computed(
  () => Boolean(props.reordering) || subTaskStore.isSubTaskBusy(props.task.id)
)

const handleToggle = () => {
  void subTaskStore.toggleSubTask(props.task.id, props.parentId)
}

const handleDelete = async () => {
  const ok = await confirm('确认删除该子任务吗？')
  if (ok) {
    await subTaskStore.deleteSubTask(props.task.id, props.parentId)
  }
}

const editInputRef = ref<HTMLTextAreaElement | null>(null)
const { isEditing, editContent, adjustHeight, handleDblClick, saveEdit, cancelEdit, onBlur } =
  useInlineEdit(
    editInputRef,
    () => props.task.content,
    (content) => {
      void subTaskStore.updateSubTaskContent(props.task.id, props.parentId, content)
    }
  )

const onSubMouseEnter = () => setHoverSubTask(props.task.id, props.parentId)
const onSubMouseLeave = () => setHoverTask(props.parentId)
</script>

<template>
  <div
    class="sub"
    :class="{ 'sub--done': task.is_completed, 'sub--busy': isBusy }"
    :data-subtask-id="task.id"
    :data-parent-id="parentId"
    @mouseenter="onSubMouseEnter"
    @mouseleave="onSubMouseLeave"
  >
    <div class="sub__drag-handle" :class="{ 'sub__drag-handle--hidden': isEditing }">
      <GripVertical :size="12" />
    </div>

    <button
      class="sub__check"
      :class="{ 'sub__check--on': task.is_completed }"
      :disabled="isBusy"
      @click="handleToggle"
    >
      <Check v-if="task.is_completed" class="sub__check-svg" :size="9" />
    </button>

    <textarea
      v-if="isEditing"
      ref="editInputRef"
      v-model="editContent"
      class="sub__edit-area"
      maxlength="200"
      rows="1"
      @keydown.enter.exact.prevent="saveEdit"
      @keyup.escape="cancelEdit"
      @blur="onBlur"
      @input="adjustHeight"
    />
    <div v-else class="sub__text" @dblclick="handleDblClick">
      {{ task.content }}
      <span v-if="isSaving" class="sub__status">保存中</span>
      <span v-else-if="isDeleting" class="sub__status sub__status--danger">删除中</span>
    </div>

    <button
      class="sub__del"
      :class="{ 'sub__del--hidden': isEditing }"
      :disabled="isBusy"
      @click="handleDelete"
    >
      <X :size="11" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.sub {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  padding: 5px 6px 5px 5px;
  border-radius: 6px;
  transition: background-color 0.15s ease;

  &:hover {
    background: $accent-soft;

    .sub__drag-handle,
    .sub__del {
      opacity: 1;
    }
  }

  &--done {
    .sub__text {
      color: $text-muted;
      text-decoration: line-through;
      text-decoration-color: rgba($text-muted, 0.3);
    }

    .sub__check {
      background: $text-muted;
      border-color: $text-muted;

      &:hover:not(:disabled) {
        background: $text-secondary;
        border-color: $text-secondary;
      }
    }

    .sub__check-svg {
      color: #fff;
    }
  }

  &--busy {
    opacity: 0.82;
  }

  &--dragging {
    opacity: 0.95;
    transform: rotate(1deg) scale(1.01);
    box-shadow:
      0 6px 18px rgba(37, 99, 235, 0.12),
      0 0 0 1px rgba($accent-color, 0.18);
    background: $bg-elevated;
    z-index: 5;

    .sub__drag-handle {
      opacity: 1 !important;
      color: $accent-color;
      cursor: grabbing;
    }
  }

  &--ghost {
    opacity: 0.3;
    background: rgba($accent-color, 0.04);
  }
}

.sub__drag-handle {
  flex-shrink: 0;
  width: 10px;
  height: 18px;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;
  opacity: 0;
  cursor: grab;
  transition: all 0.15s ease;
  border-radius: 4px;

  &:hover {
    color: $accent-color;
  }

  &:active {
    cursor: grabbing;
  }

  &--hidden {
    visibility: hidden;
    pointer-events: none;
  }
}

.sub__check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border: 1.5px solid $border-light;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-elevated;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
  padding: 0;

  &:hover:not(:disabled):not(.sub__check--on) {
    border-color: $accent-color;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &--on {
    background: $text-muted;
    border-color: $text-muted;
  }
}

.sub__check-svg {
  color: #fff;
}

.sub__text {
  flex: 1;
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-line;
  user-select: text;
  cursor: text;
}

.sub__status {
  margin-left: 8px;
  font-size: $font-xs;
  color: $text-muted;

  &--danger {
    color: $danger-color;
  }
}

.sub__edit-area {
  flex: 1;
  background: transparent;
  color: $text-primary;
  font-size: $font-sm;
  line-height: 1.55;
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

.sub__del {
  flex-shrink: 0;
  opacity: 0;
  padding: 2px;
  background: transparent;
  border: none;
  color: $text-muted;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 4px;

  &:hover:not(:disabled) {
    color: $danger-color;
    background: rgba($danger-color, 0.08);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  &--hidden {
    visibility: hidden;
    pointer-events: none;
  }
}
</style>
