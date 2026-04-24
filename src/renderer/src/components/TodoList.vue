<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { ClipboardList, Sparkles } from 'lucide-vue-next'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { useTaskDragAutoScroll } from '../composables/useTaskDragAutoScroll'
import { FOCUS_SEARCH_EVENT } from '../composables/useHotkeys'
import { useContextMenu } from '../composables/useContextMenu'
import { useSidebarResize } from '../composables/useSidebarResize'
import { useTaskMoveDrag } from '../composables/useTaskMoveDrag'
import { useGlobalSearchStore } from '../store/globalSearch'
import { useTaskStore } from '../store/task'
import { MIN_SIDEBAR_WIDTH, MIN_TODO_WIDTH } from '../../../shared/constants/layout'
import type { Task } from '../../../shared/types/models'
import { getCategoryDisplayName } from '../utils/taskNavigation'
import ArchiveView from './ArchiveView.vue'
import CategoryList from './CategoryList.vue'
import TodoInput from './TodoInput.vue'
import TodoItem from './TodoItem.vue'
import TodoSearchBar from './TodoSearchBar.vue'

const app = useAppFacade()
const { tasks, isLoading, selectedTaskView, isArchiveTaskViewActive } = app
const { confirm } = useAppRuntime().confirm
const taskStore = useTaskStore()
const globalSearchStore = useGlobalSearchStore()
const { sidebarWidth, startResize } = useSidebarResize()
useTaskDragAutoScroll()

const dragStartOrder = ref<number[]>([])
const searchQuery = ref('')
const isSearchExpanded = ref(false)
const searchBar = ref<{ focusSearch: () => void } | null>(null)
const {
  menu: taskContextMenu,
  menuRef: taskContextMenuRef,
  open: openTaskContextMenu,
  close: closeTaskContextMenu,
  reposition: repositionTaskContextMenu
} = useContextMenu<{ taskId: number }>()
const { dragTaskId, dropHandled, dropCategoryId, startTaskMoveDrag, clearTaskMoveDrag } =
  useTaskMoveDrag()

const isArchivePane = computed(() => isArchiveTaskViewActive.value)
const currentViewTitle = computed(() => app.currentTaskViewLabel.value)
const isAllTasksView = computed(() => app.isAllTasksView.value)
const hasTaskScope = computed(() => app.currentTaskScopeKey.value !== null)
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const hasActiveSearch = computed(() => normalizedSearchQuery.value.length > 0)
const currentPendingCount = computed(() => {
  if (isAllTasksView.value) {
    return app.allPendingCount.value
  }

  return tasks.value.filter((task) => !task.is_completed && task.parent_id === null).length
})
const completedCount = computed(() => tasks.value.filter((task) => task.is_completed).length)
const filteredTasks = computed(() => {
  if (!normalizedSearchQuery.value) {
    return tasks.value
  }

  return tasks.value.filter((task) =>
    task.content.toLocaleLowerCase().includes(normalizedSearchQuery.value)
  )
})
const taskContextMenuTask = computed(() => {
  const taskId = taskContextMenu.value.data?.taskId
  if (taskId === undefined) {
    return null
  }

  return tasks.value.find((task) => task.id === taskId) ?? null
})
const taskMoveTargets = computed(() => {
  const task = taskContextMenuTask.value
  if (!task) {
    return []
  }

  return app.categories.value
    .filter((category) => category.id !== task.category_id)
    .map((category) => ({
      id: category.id,
      label: getCategoryDisplayName(category)
    }))
})
const archiveCompletedTitle = computed(() =>
  isAllTasksView.value ? '归档“全部”视图中的已完成任务' : '归档当前分类中的已完成任务'
)
const archiveCompletedLabel = computed(() =>
  isAllTasksView.value
    ? `归档全部已完成 (${completedCount.value})`
    : `归档已完成 (${completedCount.value})`
)
const archiveCompletedConfirmText = computed(() =>
  isAllTasksView.value
    ? `确认归档“全部”视图中的 ${completedCount.value} 个已完成待办吗？`
    : `确认归档当前分类中的 ${completedCount.value} 个已完成待办吗？`
)
const taskContextMenuStyle = computed(() => ({
  left: `${taskContextMenu.value.x}px`,
  top: `${taskContextMenu.value.y}px`,
  maxHeight:
    taskContextMenu.value.maxHeight === null ? undefined : `${taskContextMenu.value.maxHeight}px`,
  maxWidth:
    taskContextMenu.value.maxWidth === null ? undefined : `${taskContextMenu.value.maxWidth}px`
}))

const draggableTasks = computed({
  get: () => taskStore.tasks,
  set: (value) => {
    taskStore.tasks = value
  }
})

const handleArchiveCompleted = async () => {
  const confirmed = await confirm(archiveCompletedConfirmText.value)
  if (confirmed) {
    await app.archiveCompletedTasks()
  }
}

function resolveDraggedTask(oldIndex?: number): Task | null {
  if (oldIndex === undefined || oldIndex < 0) {
    return null
  }

  return taskStore.tasks[oldIndex] ?? null
}

const onDragStart = (event: { oldIndex?: number }) => {
  dragStartOrder.value = taskStore.tasks.map((task) => task.id)

  const draggedTask = resolveDraggedTask(event.oldIndex)
  if (draggedTask) {
    startTaskMoveDrag(draggedTask)
    return
  }

  clearTaskMoveDrag()
}

const onDragEnd = async () => {
  const wasDroppedToCategory = dropHandled.value
  const draggedTaskId = dragTaskId.value
  const targetCategoryId = dropCategoryId.value

  if (!wasDroppedToCategory && !isAllTasksView.value) {
    await app.reorderTasks(dragStartOrder.value)
  }

  clearTaskMoveDrag()
  dragStartOrder.value = []

  if (wasDroppedToCategory && draggedTaskId !== null && targetCategoryId !== null) {
    await app.moveTaskToCategory(draggedTaskId, targetCategoryId)
  }
}

function handleTaskDragSetData(dataTransfer: DataTransfer) {
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData('text/plain', 'lf-todo-task')
}

function handleFocusSearchRequested() {
  searchBar.value?.focusSearch()
}

function handleTaskContextMenu(event: MouseEvent, task: Task) {
  openTaskContextMenu(event, { taskId: task.id })
}

async function handleMoveTaskToCategory(targetCategoryId: number) {
  const taskId = taskContextMenu.value.data?.taskId
  closeTaskContextMenu()

  if (taskId === undefined) {
    return
  }

  await app.moveTaskToCategory(taskId, targetCategoryId)
}

watch(selectedTaskView, () => {
  searchQuery.value = ''
  isSearchExpanded.value = false
  closeTaskContextMenu()
})

watch(taskContextMenuTask, (task) => {
  if (!task && taskContextMenu.value.visible) {
    closeTaskContextMenu()
  }
})

watch(taskContextMenuRef, (element) => {
  if (element && taskContextMenu.value.visible) {
    repositionTaskContextMenu()
  }
})

watch(
  [() => globalSearchStore.pendingRevealTaskId, tasks, isArchiveTaskViewActive],
  async ([pendingRevealTaskId, , archivePaneActive]) => {
    if (archivePaneActive) return
    if (!pendingRevealTaskId) return
    if (!tasks.value.some((task) => task.id === pendingRevealTaskId)) return

    await nextTick()

    let target = document.querySelector<HTMLElement>(`[data-task-id="${pendingRevealTaskId}"]`)

    if (!target && hasActiveSearch.value) {
      searchQuery.value = ''
      isSearchExpanded.value = false
      await nextTick()
      target = document.querySelector<HTMLElement>(`[data-task-id="${pendingRevealTaskId}"]`)
    }

    if (!target) return

    target.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    })
    target.focus({ preventScroll: true })

    globalSearchStore.clearPendingReveal(pendingRevealTaskId)
    globalSearchStore.highlightTask(pendingRevealTaskId)
  },
  { flush: 'post' }
)

onMounted(() => {
  window.addEventListener(FOCUS_SEARCH_EVENT, handleFocusSearchRequested)
})

onUnmounted(() => {
  window.removeEventListener(FOCUS_SEARCH_EVENT, handleFocusSearchRequested)
  clearTaskMoveDrag()
  closeTaskContextMenu()
})
</script>

<template>
  <div class="todo-layout">
    <div
      :style="{ width: `${sidebarWidth}px`, minWidth: `${MIN_SIDEBAR_WIDTH}px` }"
      class="todo-layout__sidebar"
    >
      <CategoryList />
    </div>
    <div
      class="todo-layout__resizer"
      :style="{ left: sidebarWidth + 'px' }"
      @mousedown="startResize"
    ></div>

    <ArchiveView v-if="isArchivePane" :style="{ minWidth: `${MIN_TODO_WIDTH}px` }" />

    <div v-else class="todo-panel" :style="{ minWidth: `${MIN_TODO_WIDTH}px` }">
      <header class="todo-panel__header">
        <div class="todo-panel__title-group">
          <h1 class="todo-panel__title">
            {{ currentViewTitle }}
          </h1>
          <TodoSearchBar
            v-if="hasTaskScope"
            ref="searchBar"
            v-model="searchQuery"
            v-model:expanded="isSearchExpanded"
          />
        </div>
        <div class="todo-panel__actions">
          <span v-if="hasTaskScope" class="todo-panel__badge">
            <span class="todo-panel__badge-num">
              {{ currentPendingCount }}
            </span>
            <span class="todo-panel__badge-label">待办</span>
          </span>
          <span v-if="taskStore.isReorderingTasks" class="todo-panel__status">排序保存中...</span>
          <button
            v-if="hasTaskScope"
            :disabled="completedCount === 0 || taskStore.isArchivingCompleted"
            class="todo-panel__clear-btn"
            :title="archiveCompletedTitle"
            @click="handleArchiveCompleted"
          >
            {{ taskStore.isArchivingCompleted ? '归档中...' : archiveCompletedLabel }}
          </button>
        </div>
      </header>

      <TodoInput v-if="hasTaskScope" />

      <div class="todo-panel__body">
        <div v-if="isLoading" class="todo-panel__loading">
          <div class="todo-panel__spinner">
            <div class="todo-panel__dot"></div>
            <div class="todo-panel__dot"></div>
            <div class="todo-panel__dot"></div>
          </div>
        </div>
        <template v-else>
          <div v-if="!hasTaskScope" class="todo-panel__empty">
            <div class="todo-panel__empty-glow">
              <ClipboardList class="todo-panel__empty-svg" :size="32" />
            </div>
            <div class="todo-panel__empty-title">请选择暂存区、全部或一个分类</div>
            <div class="todo-panel__empty-hint">左侧导航会把系统视图、分类和归档明确分开</div>
          </div>
          <div v-else-if="tasks.length === 0" class="todo-panel__empty">
            <div class="todo-panel__empty-glow todo-panel__empty-glow--spark">
              <Sparkles class="todo-panel__empty-svg" :size="32" />
            </div>
            <div class="todo-panel__empty-title">暂无任务</div>
            <div class="todo-panel__empty-hint">
              {{ isAllTasksView ? '这里会聚合展示所有分类中的待办' : '在上方输入框添加你的第一个待办吧' }}
            </div>
          </div>
          <div v-else-if="filteredTasks.length === 0" class="todo-panel__empty">
            <div class="todo-panel__empty-glow">
              <ClipboardList class="todo-panel__empty-svg" :size="32" />
            </div>
            <div class="todo-panel__empty-title">没有匹配结果</div>
            <div class="todo-panel__empty-hint">试试更短的关键词，或者换一个说法</div>
          </div>

          <draggable
            v-else-if="!hasActiveSearch"
            v-model="draggableTasks"
            item-key="id"
            handle=".card__drag-handle"
            ghost-class="card--ghost"
            drag-class="card--dragging"
            :animation="200"
            :disabled="taskStore.isReorderingTasks"
            :sort="!isAllTasksView"
            :set-data="handleTaskDragSetData"
            class="todo-panel__cards"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <TodoItem
                :task="element"
                :highlight-query="searchQuery"
                @task-contextmenu="handleTaskContextMenu"
              />
            </template>
          </draggable>
          <div v-else class="todo-panel__cards">
            <TodoItem
              v-for="task in filteredTasks"
              :key="task.id"
              :task="task"
              :highlight-query="searchQuery"
              @task-contextmenu="handleTaskContextMenu"
            />
          </div>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="taskContextMenu.visible"
        ref="taskContextMenuRef"
        class="context-menu"
        :style="taskContextMenuStyle"
        @click.stop
      >
        <div class="context-menu__label">移动到</div>
        <button
          v-for="target in taskMoveTargets"
          :key="target.id"
          class="context-menu__item"
          @click="handleMoveTaskToCategory(target.id)"
        >
          {{ target.label }}
        </button>
        <div v-if="taskMoveTargets.length === 0" class="context-menu__empty">没有可移动的分类</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-layout {
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.todo-layout__sidebar {
  height: 100%;
  flex-shrink: 0;
}

.todo-layout__resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: col-resize;
  background: transparent;
  z-index: 99;
  transform: translateX(-50%);

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: transparent;
    transition: background $transition-normal;
  }

  &:hover::after {
    background: $accent-color;
  }
}

.todo-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  background: $bg-primary;
  overflow: hidden;
}

.todo-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-lg;
  padding: $spacing-lg $spacing-xl;
  background: linear-gradient(135deg, rgba($bg-sidebar, 0.35) 0%, rgba($bg-sidebar, 0.15) 100%);
  border-bottom: 1px solid $border-subtle;
}

.todo-panel__title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.todo-panel__title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-xl;
  font-weight: 700;
  color: $text-primary;
  white-space: nowrap;
}

.todo-panel__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: $spacing-md;
}

.todo-panel__badge {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: $spacing-xs $spacing-md;
  background: $accent-soft;
  border-radius: 20px;
}

.todo-panel__badge-num {
  font-size: $font-lg;
  font-weight: 700;
  color: $accent-color;
}

.todo-panel__badge-label {
  font-size: $font-xs;
  color: $text-muted;
}

.todo-panel__status {
  font-size: $font-xs;
  color: $text-muted;
}

.todo-panel__clear-btn {
  padding: $spacing-xs $spacing-md;
  background: transparent;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  font-size: $font-xs;
  color: $text-muted;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: $accent-color;
    color: $accent-color;
    background: rgba($accent-color, 0.06);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.todo-panel__body {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: $bg-deep;
}

.todo-panel__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 32px;
}

.todo-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 280px;
  gap: $spacing-md;
}

.todo-panel__empty-glow {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba($accent-color, 0.08) 0%, rgba($accent-color, 0.04) 100%);
  border: 1px solid rgba($accent-color, 0.1);
  color: $accent-color;

  &--spark {
    background: linear-gradient(
      135deg,
      rgba(37, 99, 235, 0.14) 0%,
      rgba(96, 165, 250, 0.08) 58%,
      rgba(191, 219, 254, 0.18) 100%
    );
    border-color: rgba(37, 99, 235, 0.14);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.52),
      0 10px 24px rgba(37, 99, 235, 0.08);
    color: #3b82f6;
  }
}

.todo-panel__empty-title {
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 600;
}

.todo-panel__empty-hint {
  color: $text-muted;
  font-size: $font-sm;
}

.todo-panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}

.todo-panel__spinner {
  display: flex;
  gap: 8px;
}

.todo-panel__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: $accent-color;
  animation: pulse 1s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    animation-delay: 0.2s;
  }
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 168px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  padding: $spacing-xs;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  border: $glass-border;
  border-radius: $radius-lg;
  background: $glass-bg;
  backdrop-filter: $glass-blur;
  -webkit-backdrop-filter: $glass-blur;
  box-shadow: $shadow-lg;
}

.context-menu__label {
  position: sticky;
  top: 0;
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 700;
  background: $glass-bg;
  color: $text-muted;
  letter-spacing: 0.04em;
}

.context-menu__item {
  display: block;
  width: 100%;
  padding: $spacing-sm $spacing-md;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-primary;
  font-size: $font-sm;
  text-align: left;
  cursor: pointer;
  transition:
    background-color $transition-fast,
    color $transition-fast;

  &:hover {
    background: rgba($accent-color, 0.08);
    color: $accent-color;
  }
}

.context-menu__empty {
  padding: $spacing-sm $spacing-md;
  color: $text-muted;
  font-size: $font-sm;
}

@keyframes pulse {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: scale(0.9);
  }

  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
