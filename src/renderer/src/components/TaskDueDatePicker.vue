<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { TaskDueState } from '../../../shared/types/models'
import { CalendarDays, Clock3 } from 'lucide-vue-next'
import { useMinuteNow } from '../composables/useMinuteNow'
import {
  cloneTaskDueState,
  createTaskDueStateFromInputs,
  EMPTY_TASK_DUE_STATE,
  formatTaskDueDateInputValue,
  formatTaskDueLabel,
  formatTaskDueTimeInputValue,
  formatTaskDueTitle,
  getTaskDueTone,
  hasTaskDue
} from '../utils/taskDue'

const PANEL_WIDTH = 308
const PANEL_GAP = 8
const VIEWPORT_PADDING = 12
const PANEL_MIN_COMFORT_HEIGHT = 220

const props = withDefaults(
  defineProps<{
    dueState: TaskDueState
    completed?: boolean
    disabled?: boolean
    emptyLabel?: string
    align?: 'left' | 'right'
    variant?: 'input' | 'meta'
  }>(),
  {
    completed: false,
    disabled: false,
    emptyLabel: '截止日期',
    align: 'left',
    variant: 'meta'
  }
)

const emit = defineEmits<{
  apply: [value: TaskDueState]
  openChange: [value: boolean]
}>()

const now = useMinuteNow()

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const dateValue = ref('')
const timeValue = ref('18:00')
const withTime = ref(false)
let viewportChangeRaf = 0
const panelPosition = ref<{
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'top' | 'bottom'
} | null>(null)

const hasDueDate = computed(() => hasTaskDue(props.dueState))
const previewDueState = computed(
  () => createTaskDueStateFromInputs(dateValue.value, withTime.value, timeValue.value) ?? null
)
const canSave = computed(() => previewDueState.value !== null)
const triggerTone = computed(() => getTaskDueTone(props.dueState, props.completed, now.value))
const triggerLabel = computed(() =>
  hasDueDate.value ? formatTaskDueLabel(props.dueState, now.value) : props.emptyLabel
)
const triggerTitle = computed(() =>
  hasDueDate.value ? formatTaskDueTitle(props.dueState) : '设置截止日期'
)
const previewLabel = computed(() => {
  if (!previewDueState.value) {
    return '先选择日期，再决定是否补充具体时间'
  }

  return formatTaskDueTitle(previewDueState.value)
})

watch(
  () => props.dueState,
  () => {
    if (!open.value) {
      syncDraftFromProps()
    }
  },
  { deep: true }
)

function syncDraftFromProps() {
  const nextDueState = cloneTaskDueState(props.dueState)
  dateValue.value = formatTaskDueDateInputValue(nextDueState)
  timeValue.value = formatTaskDueTimeInputValue(nextDueState)
  withTime.value = nextDueState.due_precision === 'datetime'
}

function updatePanelPosition() {
  const trigger = triggerRef.value
  if (!trigger) {
    panelPosition.value = null
    return
  }

  const rect = trigger.getBoundingClientRect()
  const panelHeight = panelRef.value?.offsetHeight ?? 360
  const viewportMaxHeight = Math.max(160, window.innerHeight - VIEWPORT_PADDING * 2)
  const availableBelow = Math.max(
    0,
    window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_PADDING
  )
  const availableAbove = Math.max(0, rect.top - PANEL_GAP - VIEWPORT_PADDING)
  const placement =
    panelHeight > availableBelow && availableAbove > availableBelow ? 'top' : 'bottom'
  const availableHeight = placement === 'top' ? availableAbove : availableBelow
  const maxHeight =
    availableHeight >= PANEL_MIN_COMFORT_HEIGHT
      ? Math.min(availableHeight, viewportMaxHeight)
      : Math.min(viewportMaxHeight, Math.max(availableHeight, PANEL_MIN_COMFORT_HEIGHT))
  const effectiveHeight = Math.min(panelHeight, maxHeight)
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - PANEL_WIDTH - VIEWPORT_PADDING)
  const preferredLeft = props.align === 'right' ? rect.right - PANEL_WIDTH : rect.left
  const preferredTop =
    placement === 'top' ? rect.top - PANEL_GAP - effectiveHeight : rect.bottom + PANEL_GAP
  const constrainedTop = Math.min(
    Math.max(VIEWPORT_PADDING, preferredTop),
    window.innerHeight - VIEWPORT_PADDING - effectiveHeight
  )

  panelPosition.value = {
    top: constrainedTop,
    left: Math.min(Math.max(VIEWPORT_PADDING, preferredLeft), maxLeft),
    width: PANEL_WIDTH,
    maxHeight,
    placement
  }
}

async function openPopover() {
  if (props.disabled) {
    return
  }

  syncDraftFromProps()
  open.value = true
  updatePanelPosition()
  await nextTick()
  updatePanelPosition()
}

function closePopover() {
  open.value = false
}

function togglePopover() {
  if (open.value) {
    closePopover()
    return
  }

  void openPopover()
}

function applyQuickDate(offsetDays: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  dateValue.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function handleClear() {
  emit('apply', cloneTaskDueState(EMPTY_TASK_DUE_STATE))
  closePopover()
}

function handleSave() {
  if (!previewDueState.value) {
    return
  }

  emit('apply', cloneTaskDueState(previewDueState.value))
  closePopover()
}

function handleDocumentPointerDown(event: MouseEvent) {
  if (!open.value) {
    return
  }

  const target = event.target as Node

  if (triggerRef.value?.contains(target) || panelRef.value?.contains(target)) {
    return
  }

  closePopover()
}

function handleViewportChange(event?: Event) {
  if (!open.value) {
    return
  }

  const target = event?.target

  if (
    target instanceof Node &&
    (panelRef.value?.contains(target) || triggerRef.value?.contains(target))
  ) {
    return
  }

  const rect = triggerRef.value?.getBoundingClientRect()
  if (
    rect &&
    (rect.bottom < VIEWPORT_PADDING ||
      rect.top > window.innerHeight - VIEWPORT_PADDING ||
      rect.right < VIEWPORT_PADDING ||
      rect.left > window.innerWidth - VIEWPORT_PADDING)
  ) {
    closePopover()
    return
  }

  if (viewportChangeRaf) {
    window.cancelAnimationFrame(viewportChangeRaf)
  }

  viewportChangeRaf = window.requestAnimationFrame(() => {
    viewportChangeRaf = 0
    updatePanelPosition()
  })
}

onMounted(() => {
  syncDraftFromProps()
})

onUnmounted(() => {
  unbindGlobalListeners()
})

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

watch(open, (value) => {
  emit('openChange', value)

  if (value) {
    bindGlobalListeners()
    return
  }

  unbindGlobalListeners()
})

watch(withTime, async () => {
  if (!open.value) {
    return
  }

  await nextTick()
  updatePanelPosition()
})

function bindGlobalListeners() {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
}

function unbindGlobalListeners() {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)

  if (viewportChangeRaf) {
    window.cancelAnimationFrame(viewportChangeRaf)
    viewportChangeRaf = 0
  }
}
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="due-trigger"
    :class="[
      `due-trigger--${variant}`,
      `due-trigger--tone-${triggerTone}`,
      { 'due-trigger--empty': !hasDueDate }
    ]"
    :disabled="disabled"
    :title="triggerTitle"
    @click.stop="togglePopover"
    @dblclick.stop
  >
    <CalendarDays class="due-trigger__icon" :size="variant === 'input' ? 15 : 13" />
    <span class="due-trigger__label">{{ triggerLabel }}</span>
    <Clock3
      v-if="hasDueDate && dueState.due_precision === 'datetime'"
      class="due-trigger__clock"
      :size="12"
    />
  </button>

  <Transition name="due-pop">
    <Teleport to="body">
      <div
        v-if="open && panelPosition"
        ref="panelRef"
        class="due-panel"
        :class="`due-panel--${panelPosition.placement}`"
        :style="{
          top: `${panelPosition.top}px`,
          left: `${panelPosition.left}px`,
          width: `${panelPosition.width}px`,
          maxHeight: `${panelPosition.maxHeight}px`
        }"
      >
        <div class="due-panel__header">
          <div class="due-panel__title">截止日期</div>
          <div class="due-panel__subtitle">默认是日期截止，需要时再补充具体时间</div>
        </div>

        <div class="due-panel__quick-actions">
          <button type="button" class="due-panel__quick-btn" @click="applyQuickDate(0)">
            今天
          </button>
          <button type="button" class="due-panel__quick-btn" @click="applyQuickDate(1)">
            明天
          </button>
        </div>

        <label class="due-panel__field">
          <span class="due-panel__field-label">日期</span>
          <input v-model="dateValue" class="due-panel__input" type="date" />
        </label>

        <label class="due-panel__toggle">
          <input v-model="withTime" class="due-panel__checkbox" type="checkbox" />
          <span>设置具体时间</span>
        </label>

        <label v-if="withTime" class="due-panel__field">
          <span class="due-panel__field-label">时间</span>
          <input v-model="timeValue" class="due-panel__input" type="time" step="60" />
        </label>

        <div class="due-panel__preview">
          {{ previewLabel }}
        </div>

        <div class="due-panel__actions">
          <button
            v-if="hasDueDate"
            type="button"
            class="due-panel__action due-panel__action--ghost"
            @click="handleClear"
          >
            清除
          </button>
          <button
            type="button"
            class="due-panel__action due-panel__action--ghost"
            @click="closePopover"
          >
            取消
          </button>
          <button
            type="button"
            class="due-panel__action due-panel__action--primary"
            :disabled="!canSave"
            @click="handleSave"
          >
            保存
          </button>
        </div>
      </div>
    </Teleport>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.due-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  box-sizing: border-box;
  cursor: pointer;
  vertical-align: middle;
  font-family: inherit;
  transition:
    background-color $transition-fast,
    color $transition-fast,
    border-color $transition-fast,
    opacity $transition-fast;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &--input {
    flex-shrink: 0;
    align-self: stretch;
    height: auto;
    min-height: 100%;
    padding: 0 12px;
    background: transparent;
    color: $text-muted;
    border-left: 1px solid $border-color;
    font-size: $font-md;
    font-weight: 500;
    line-height: 1;

    &:hover:not(:disabled) {
      background: rgba($accent-color, 0.05);
      color: $accent-color;
      border-left-color: rgba($accent-color, 0.2);
    }
  }

  &--meta {
    height: 20px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: $font-xs;
    font-weight: 600;
    line-height: 1;
    background: rgba($accent-color, 0.05);
    color: $text-secondary;

    &:hover:not(:disabled) {
      background: rgba($accent-color, 0.1);
      color: $accent-hover;
    }
  }

  &--empty.due-trigger--meta {
    color: $text-muted;
    background: transparent;
    border: 1px dashed rgba(148, 163, 184, 0.5);

    &:hover:not(:disabled) {
      color: $accent-color;
      border-color: rgba($accent-color, 0.45);
      background: rgba($accent-color, 0.05);
    }
  }

  &--empty.due-trigger--input {
    &:hover:not(:disabled) {
      background: rgba($accent-color, 0.05);
      color: $accent-color;
      border-left-color: rgba($accent-color, 0.2);
    }
  }

  &--tone-scheduled {
    color: $accent-color;

    &.due-trigger--meta {
      background: rgba($accent-color, 0.1);

      &:hover:not(:disabled) {
        background: rgba($accent-color, 0.16);
        color: $accent-hover;
      }
    }

    &.due-trigger--input:hover:not(:disabled) {
      background: rgba($accent-color, 0.06);
      color: $accent-hover;
    }
  }

  &--tone-today {
    color: $warning-color;

    &.due-trigger--meta {
      background: rgba($warning-color, 0.1);

      &:hover:not(:disabled) {
        background: rgba($warning-color, 0.16);
        color: #b45309;
      }
    }

    &.due-trigger--input:hover:not(:disabled) {
      background: rgba($warning-color, 0.06);
      color: #b45309;
    }
  }

  &--tone-overdue {
    color: $danger-color;

    &.due-trigger--meta {
      background: rgba($danger-color, 0.08);

      &:hover:not(:disabled) {
        background: rgba($danger-color, 0.14);
        color: #b91c1c;
      }
    }

    &.due-trigger--input:hover:not(:disabled) {
      background: rgba($danger-color, 0.05);
      color: #b91c1c;
    }
  }

  &--tone-done {
    color: $text-muted;

    &.due-trigger--meta {
      background: rgba(148, 163, 184, 0.12);

      &:hover:not(:disabled) {
        background: rgba(148, 163, 184, 0.18);
        color: $text-secondary;
      }
    }

    &.due-trigger--input:hover:not(:disabled) {
      background: rgba(148, 163, 184, 0.08);
      color: $text-secondary;
    }
  }
}

.due-trigger__label {
  display: inline-flex;
  align-items: center;
  font-size: inherit;
  white-space: nowrap;
  line-height: 1;
}

.due-trigger__icon,
.due-trigger__clock {
  display: block;
  flex-shrink: 0;
  align-self: center;
}

.due-trigger--meta .due-trigger__label {
  min-height: 12px;
  transform: translateY(-0.25px);
}

.due-trigger--meta .due-trigger__icon,
.due-trigger--meta .due-trigger__clock {
  transform: translateY(-0.5px);
}

.due-trigger--meta .due-trigger__icon {
  width: 13px;
  height: 13px;
}

.due-trigger--meta .due-trigger__clock {
  width: 12px;
  height: 12px;
}

.due-panel {
  position: fixed;
  z-index: 260;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: $shadow-lg;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.due-panel__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.due-panel__title {
  font-size: $font-lg;
  font-weight: 700;
  color: $text-primary;
}

.due-panel__subtitle {
  font-size: $font-sm;
  line-height: 1.5;
  color: $text-muted;
}

.due-panel__quick-actions {
  display: flex;
  gap: 8px;
}

.due-panel__quick-btn,
.due-panel__action {
  border: none;
  border-radius: $radius-md;
  cursor: pointer;
  transition:
    background-color $transition-fast,
    color $transition-fast,
    opacity $transition-fast;
}

.due-panel__quick-btn {
  padding: 7px 12px;
  background: rgba($accent-color, 0.08);
  color: $accent-color;
  font-size: $font-sm;
  font-weight: 600;

  &:hover {
    background: rgba($accent-color, 0.14);
  }
}

.due-panel__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.due-panel__field-label {
  font-size: $font-sm;
  font-weight: 600;
  color: $text-secondary;
}

.due-panel__input {
  width: 100%;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-input;
  color: $text-primary;
  font-size: $font-md;
  padding: 9px 12px;
  outline: none;

  &:focus {
    border-color: $accent-color;
    box-shadow: $shadow-glow;
  }
}

.due-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: $text-secondary;
  font-size: $font-sm;
}

.due-panel__checkbox {
  width: 14px;
  height: 14px;
  accent-color: $accent-color;
}

.due-panel__preview {
  padding: 10px 12px;
  border-radius: $radius-md;
  background: rgba(15, 23, 42, 0.04);
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.5;
}

.due-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.due-panel__action {
  padding: 8px 14px;
  font-size: $font-sm;
  font-weight: 600;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--ghost {
    background: transparent;
    color: $text-secondary;

    &:hover:not(:disabled) {
      background: rgba($accent-color, 0.08);
      color: $accent-color;
    }
  }

  &--primary {
    background: $accent-color;
    color: #fff;

    &:hover:not(:disabled) {
      background: $accent-hover;
    }
  }
}

.due-pop-enter-active,
.due-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.due-pop-enter-from,
.due-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
