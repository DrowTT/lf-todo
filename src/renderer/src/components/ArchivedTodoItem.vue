<script setup lang="ts">
import { computed } from 'vue'
import type { ArchivedTaskGroup } from '../../../shared/types/models'
import { usePomodoroStore } from '../store/pomodoro'
import { buildSearchHighlightParts } from '../utils/searchHighlight'
import { Check, FolderOpen, RotateCcw, Timer } from 'lucide-vue-next'

const props = defineProps<{
  group: ArchivedTaskGroup
  highlightQuery?: string
  selected?: boolean
  restoring?: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle-select', checked: boolean): void
  (event: 'restore'): void
}>()

const pomodoroStore = usePomodoroStore()

const pomodoroCount = computed(() => pomodoroStore.getTaskPomodoroCount(props.group.task.id))
const contentHighlightParts = computed(() =>
  buildSearchHighlightParts(props.group.task.content, props.highlightQuery ?? '')
)

function buildParts(content: string) {
  return buildSearchHighlightParts(content, props.highlightQuery ?? '')
}

function formatDateTime(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined) {
    return '未知时间'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp * 1000)
}

function handleSelectionChange(event: Event) {
  emit('toggle-select', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <article class="archive-card" :class="{ 'archive-card--selected': selected }">
    <div class="archive-card__header">
      <label class="archive-card__check">
        <input
          type="checkbox"
          :checked="selected"
          :disabled="restoring"
          @change="handleSelectionChange"
        />
        <span class="archive-card__check-ui"></span>
      </label>

      <div class="archive-card__main">
        <div class="archive-card__title">
          <template v-for="(part, index) in contentHighlightParts" :key="`${group.task.id}-${index}`">
            <mark v-if="part.matched" class="archive-card__mark">{{ part.text }}</mark>
            <span v-else>{{ part.text }}</span>
          </template>
        </div>

        <div class="archive-card__meta">
          <span class="archive-card__chip archive-card__chip--category">
            <FolderOpen :size="12" />
            {{ group.task.archived_category_name ?? '未知分类' }}
          </span>
          <span class="archive-card__chip archive-card__chip--muted">
            创建于 {{ formatDateTime(group.task.created_at) }}
          </span>
          <span v-if="pomodoroCount > 0" class="archive-card__chip archive-card__chip--pomodoro">
            <Timer :size="12" />
            {{ pomodoroCount }} 个番茄
          </span>
        </div>
      </div>

      <button class="archive-card__restore" :disabled="restoring" @click="emit('restore')">
        <RotateCcw :size="13" />
        {{ restoring ? '恢复中...' : '恢复' }}
      </button>
    </div>

    <div v-if="group.subTasks.length > 0" class="archive-card__subtasks">
      <div v-for="subTask in group.subTasks" :key="subTask.id" class="archive-card__subtask">
        <span class="archive-card__subtask-check">
          <Check :size="11" />
        </span>
        <div class="archive-card__subtask-text">
          <template
            v-for="(part, index) in buildParts(subTask.content)"
            :key="`${subTask.id}-${index}`"
          >
            <mark v-if="part.matched" class="archive-card__mark">{{ part.text }}</mark>
            <span v-else>{{ part.text }}</span>
          </template>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.archive-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  background: $bg-elevated;
  border: 1px solid $border-color;
  border-radius: 16px;
  box-shadow:
    0 1px 3px rgba(15, 23, 42, 0.05),
    0 10px 24px rgba(15, 23, 42, 0.04);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: rgba($accent-color, 0.18);
    box-shadow:
      0 4px 12px rgba(15, 23, 42, 0.06),
      0 16px 30px rgba(15, 23, 42, 0.05);
  }

  &--selected {
    border-color: rgba($accent-color, 0.34);
    box-shadow:
      0 0 0 1px rgba($accent-color, 0.14),
      0 16px 30px rgba($accent-color, 0.08);
  }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  &__check {
    position: relative;
    width: 18px;
    height: 18px;
    margin-top: 3px;
    flex-shrink: 0;
    cursor: pointer;

    input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      margin: 0;
    }
  }

  &__check-ui {
    position: relative;
    display: block;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 6px;
    border: 1.5px solid rgba($accent-color, 0.28);
    background: rgba($accent-color, 0.04);
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 5px;
      height: 9px;
      border-right: 2px solid #fff;
      border-bottom: 2px solid #fff;
      opacity: 0;
      transform: translate(-50%, -58%) rotate(45deg);
      transition: opacity 0.12s ease;
    }
  }

  &__check input:checked + &__check-ui {
    background: $accent-color;
    border-color: $accent-color;
    box-shadow: 0 0 0 4px rgba($accent-color, 0.08);
  }

  &__check input:checked + &__check-ui::after {
    opacity: 1;
  }

  &__check input:disabled + &__check-ui {
    opacity: 0.5;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: $font-lg;
    font-weight: 600;
    line-height: 1.65;
    color: $text-primary;
    word-break: break-word;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba($accent-color, 0.08);
    color: $text-secondary;
    font-size: $font-xs;
    line-height: 1.3;

    &--category {
      color: $accent-color;
      background: $accent-soft;
    }

    &--muted {
      background: rgba(15, 23, 42, 0.05);
      color: $text-muted;
    }

    &--pomodoro {
      color: #c2410c;
      background: rgba(249, 115, 22, 0.1);
    }
  }

  &__restore {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    padding: 5px 0;
    border: none;
    background: transparent;
    color: $text-secondary;
    font-size: $font-xs;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 0.15s ease,
      opacity 0.15s ease;

    &:hover:not(:disabled) {
      color: $accent-color;
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  &__subtasks {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 12px 4px;
    background: rgba(15, 23, 42, 0.035);
    border-radius: 12px;
  }

  &__subtask {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: $font-sm;
    color: $text-secondary;
    line-height: 1.6;
  }

  &__subtask-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-top: 3px;
    border-radius: 5px;
    background: rgba($accent-color, 0.12);
    color: $accent-color;
    flex-shrink: 0;
  }

  &__subtask-text {
    flex: 1;
    word-break: break-word;
  }

  &__mark {
    padding: 0 2px;
    border-radius: 4px;
    background: rgba($warning-color, 0.18);
    color: inherit;
  }
}
</style>
