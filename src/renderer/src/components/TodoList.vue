<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { ClipboardList, Sparkles } from 'lucide-vue-next'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { FOCUS_SEARCH_EVENT } from '../composables/useHotkeys'
import { useSidebarResize } from '../composables/useSidebarResize'
import { useGlobalSearchStore } from '../store/globalSearch'
import { useTaskStore } from '../store/task'
import { MIN_SIDEBAR_WIDTH, MIN_TODO_WIDTH } from '../../../shared/constants/layout'
import ArchiveView from './ArchiveView.vue'
import CategoryList from './CategoryList.vue'
import TodoInput from './TodoInput.vue'
import TodoItem from './TodoItem.vue'
import TodoSearchBar from './TodoSearchBar.vue'

const app = useAppFacade()
const { currentCategoryId, categories, tasks, isLoading, taskPaneView } = app
const { confirm } = useAppRuntime().confirm
const taskStore = useTaskStore()
const globalSearchStore = useGlobalSearchStore()
const { sidebarWidth, startResize } = useSidebarResize()

const dragStartOrder = ref<number[]>([])
const searchQuery = ref('')
const isSearchExpanded = ref(false)
const searchBar = ref<{ focusSearch: () => void } | null>(null)

const isArchivePane = computed(() => taskPaneView.value === 'archive')
const currentCategory = computed(() =>
  categories.value.find((item) => item.id === currentCategoryId.value) ?? null
)
const currentCategoryName = computed(() => currentCategory.value?.name ?? '未选择分类')
const isSystemCategoryView = computed(() => currentCategory.value?.is_system ?? false)
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const hasActiveSearch = computed(() => normalizedSearchQuery.value.length > 0)
const currentPendingCount = computed(
  () => tasks.value.filter((task) => !task.is_completed && task.parent_id === null).length
)
const completedCount = computed(() => tasks.value.filter((task) => task.is_completed).length)
const filteredTasks = computed(() => {
  if (!normalizedSearchQuery.value) {
    return tasks.value
  }

  return tasks.value.filter((task) =>
    task.content.toLocaleLowerCase().includes(normalizedSearchQuery.value)
  )
})
const archiveCompletedTitle = computed(() =>
  isSystemCategoryView.value ? '归档全部分类中的已完成任务' : '归档已完成任务'
)
const archiveCompletedLabel = computed(() =>
  isSystemCategoryView.value
    ? `归档全部已完成 (${completedCount.value})`
    : `归档已完成 (${completedCount.value})`
)
const archiveCompletedConfirmText = computed(() =>
  isSystemCategoryView.value
    ? `确认归档“全部”视图中的 ${completedCount.value} 个已完成待办吗？`
    : `确认归档 ${completedCount.value} 个已完成待办吗？`
)

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

const onDragStart = () => {
  dragStartOrder.value = taskStore.tasks.map((task) => task.id)
}

const onDragEnd = async () => {
  await app.reorderTasks(dragStartOrder.value)
  dragStartOrder.value = []
}

function handleFocusSearchRequested() {
  searchBar.value?.focusSearch()
}

watch([currentCategoryId, taskPaneView], () => {
  searchQuery.value = ''
  isSearchExpanded.value = false
})

watch(
  [() => globalSearchStore.pendingRevealTaskId, tasks, taskPaneView],
  async ([pendingRevealTaskId, , paneView]) => {
    if (paneView === 'archive') return
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
            {{ currentCategoryName }}
          </h1>
          <TodoSearchBar
            v-if="currentCategoryId"
            ref="searchBar"
            v-model="searchQuery"
            v-model:expanded="isSearchExpanded"
          />
        </div>
        <div class="todo-panel__actions">
          <span v-if="currentCategoryId" class="todo-panel__badge">
            <span class="todo-panel__badge-num">
              {{ currentPendingCount }}
            </span>
            <span class="todo-panel__badge-label">待办</span>
          </span>
          <span v-if="taskStore.isReorderingTasks" class="todo-panel__status">排序保存中...</span>
          <button
            v-if="currentCategoryId"
            :disabled="completedCount === 0 || taskStore.isArchivingCompleted"
            class="todo-panel__clear-btn"
            :title="archiveCompletedTitle"
            @click="handleArchiveCompleted"
          >
            {{ taskStore.isArchivingCompleted ? '归档中...' : archiveCompletedLabel }}
          </button>
        </div>
      </header>

      <TodoInput v-if="currentCategoryId" />

      <div class="todo-panel__body">
        <div v-if="isLoading" class="todo-panel__loading">
          <div class="todo-panel__spinner">
            <div class="todo-panel__dot"></div>
            <div class="todo-panel__dot"></div>
            <div class="todo-panel__dot"></div>
          </div>
        </div>
        <template v-else>
          <div v-if="!currentCategoryId" class="todo-panel__empty">
            <div class="todo-panel__empty-glow">
              <ClipboardList class="todo-panel__empty-svg" :size="32" />
            </div>
            <div class="todo-panel__empty-title">请选择或创建一个分类</div>
            <div class="todo-panel__empty-hint">在左侧添加分类后即可开始管理待办</div>
          </div>
          <div v-else-if="tasks.length === 0" class="todo-panel__empty">
            <div class="todo-panel__empty-glow todo-panel__empty-glow--spark">
              <Sparkles class="todo-panel__empty-svg" :size="32" />
            </div>
            <div class="todo-panel__empty-title">暂无任务</div>
            <div class="todo-panel__empty-hint">在上方输入框添加你的第一个待办吧</div>
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
            :disabled="taskStore.isReorderingTasks || isSystemCategoryView"
            class="todo-panel__cards"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <TodoItem :task="element" :highlight-query="searchQuery" />
            </template>
          </draggable>
          <div v-else class="todo-panel__cards">
            <TodoItem
              v-for="task in filteredTasks"
              :key="task.id"
              :task="task"
              :highlight-query="searchQuery"
            />
          </div>
        </template>
      </div>
    </div>
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
    background: linear-gradient(135deg, rgba(255, 196, 88, 0.12) 0%, rgba(255, 196, 88, 0.05) 100%);
    color: #d97706;
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
