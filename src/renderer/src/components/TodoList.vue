<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { ClipboardList, Sparkles } from 'lucide-vue-next'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { useSidebarResize } from '../composables/useSidebarResize'
import { useTaskStore } from '../store/task'
import CategoryList from './CategoryList.vue'
import TodoInput from './TodoInput.vue'
import TodoItem from './TodoItem.vue'
import TodoSearchBar from './TodoSearchBar.vue'

const app = useAppFacade()
const { currentCategoryId, categories, tasks, isLoading } = app
const { confirm } = useAppRuntime().confirm
const taskStore = useTaskStore()
const { sidebarWidth, startResize } = useSidebarResize()

const dragStartOrder = ref<number[]>([])
const searchQuery = ref('')
const isSearchExpanded = ref(false)

const currentCategoryName = computed(() => {
  const category = categories.value.find((item) => item.id === currentCategoryId.value)
  return category ? category.name : '未选择分类'
})

const currentPendingCount = computed(
  () => tasks.value.filter((task) => !task.is_completed && task.parent_id === null).length
)

const completedCount = computed(() => tasks.value.filter((task) => task.is_completed).length)
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const hasActiveSearch = computed(() => normalizedSearchQuery.value.length > 0)
const filteredTasks = computed(() => {
  if (!normalizedSearchQuery.value) {
    return tasks.value
  }

  return tasks.value.filter((task) =>
    task.content.toLocaleLowerCase().includes(normalizedSearchQuery.value)
  )
})

const draggableTasks = computed({
  get: () => taskStore.tasks,
  set: (value) => {
    taskStore.tasks = value
  }
})

const handleClearCompleted = async () => {
  const confirmed = await confirm(`确认删除 ${completedCount.value} 个已完成的待办吗？`)
  if (confirmed) {
    await app.clearCompletedTasks()
  }
}

const onDragStart = () => {
  dragStartOrder.value = taskStore.tasks.map((task) => task.id)
}

const onDragEnd = async () => {
  await app.reorderTasks(dragStartOrder.value)
  dragStartOrder.value = []
}

watch(currentCategoryId, () => {
  searchQuery.value = ''
  isSearchExpanded.value = false
})
</script>

<template>
  <div class="todo-layout">
    <div :style="{ width: sidebarWidth + 'px' }" class="todo-layout__sidebar">
      <CategoryList />
    </div>
    <div
      class="todo-layout__resizer"
      :style="{ left: sidebarWidth + 'px' }"
      @mousedown="startResize"
    ></div>

    <div class="todo-panel">
      <header class="todo-panel__header">
        <div class="todo-panel__title-group">
          <h1 class="todo-panel__title">
            {{ currentCategoryName }}
          </h1>
          <TodoSearchBar
            v-if="currentCategoryId"
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
          <span v-if="taskStore.isReorderingTasks" class="todo-panel__status">排序保存中</span>
          <button
            v-if="currentCategoryId"
            :disabled="completedCount === 0 || taskStore.isClearingCompleted"
            class="todo-panel__clear-btn"
            title="清空已完成"
            @click="handleClearCompleted"
          >
            {{ taskStore.isClearingCompleted ? '删除中...' : `清空已完成 (${completedCount})` }}
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
            :disabled="taskStore.isReorderingTasks"
            class="todo-panel__cards"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <TodoItem :task="element" />
            </template>
          </draggable>
          <div v-else class="todo-panel__cards">
            <TodoItem v-for="task in filteredTasks" :key="task.id" :task="task" />
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
  overflow: visible;
}

.todo-panel__title {
  flex-shrink: 0;
  font-size: $font-xl;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: 0.5px;
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
  transition: all $transition-normal;

  &:hover:not(:disabled) {
    border-color: $danger-color;
    color: $danger-color;
    background: rgba($danger-color, 0.06);
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
  animation: empty-fade-in 0.5s ease;
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
  margin-bottom: $spacing-sm;
  transition: transform $transition-slow;

  &--spark {
    background: linear-gradient(
      135deg,
      rgba($warning-color, 0.1) 0%,
      rgba($warning-color, 0.04) 100%
    );
    border-color: rgba($warning-color, 0.12);
    color: $warning-color;
  }
}

.todo-panel__empty-svg {
  opacity: 0.85;
}

.todo-panel__empty-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-secondary;
}

.todo-panel__empty-hint {
  font-size: $font-sm;
  color: $text-muted;
}

@keyframes empty-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-list-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card-list-leave-active {
  transition: all 0.2s ease;
}

.card-list-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.card-list-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.96);
}

.card-list-move {
  transition: transform 0.3s ease;
}

.todo-panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.todo-panel__spinner {
  display: flex;
  gap: 6px;
}

.todo-panel__dot {
  width: 8px;
  height: 8px;
  background: $accent-color;
  border-radius: 50%;
  animation: dot-bounce 1.2s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.15s;
  }

  &:nth-child(3) {
    animation-delay: 0.3s;
  }
}

@keyframes dot-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  40% {
    transform: translateY(-8px);
    opacity: 1;
  }
}
</style>
