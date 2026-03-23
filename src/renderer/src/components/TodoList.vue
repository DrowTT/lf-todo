<script setup lang="ts">
import { store } from '../store'
import TodoInput from './TodoInput.vue'
import TodoItem from './TodoItem.vue'
import { computed } from 'vue'
import { useConfirm } from '../composables/useConfirm'

const { confirm } = useConfirm()

const currentCategoryName = computed(() => {
  const cat = store.categories.find((c) => c.id === store.currentCategoryId)
  return cat ? cat.name : '未选择分类'
})

const completedCount = computed(() => {
  return store.tasks.filter((t) => t.is_completed).length
})

const handleClearCompleted = async () => {
  const confirmed = await confirm(`确认删除 ${completedCount.value} 个已完成的待办吗?`)
  if (confirmed) {
    store.clearCompletedTasks()
  }
}
</script>

<template>
  <div class="todo-panel">
    <!-- 顶栏 -->
    <header class="todo-panel__header">
      <h1 class="todo-panel__title">
        {{ currentCategoryName }}
      </h1>
      <div class="todo-panel__actions">
        <span class="todo-panel__badge" v-if="store.currentCategoryId">
          <span class="todo-panel__badge-num">{{ store.pendingCounts[store.currentCategoryId] ?? 0 }}</span>
          <span class="todo-panel__badge-label">待办</span>
        </span>
        <button
          v-if="store.currentCategoryId"
          @click="handleClearCompleted"
          :disabled="completedCount === 0"
          class="todo-panel__clear-btn"
          title="清空已完成"
        >
          清空已完成 ({{ completedCount }})
        </button>
      </div>
    </header>

    <!-- 输入 -->
    <TodoInput v-if="store.currentCategoryId" />

    <!-- 列表 -->
    <div class="todo-panel__body">
      <!-- 加载态 -->
      <div v-if="store.isLoading" class="todo-panel__loading">
        <div class="todo-panel__spinner">
          <div class="todo-panel__dot"></div>
          <div class="todo-panel__dot"></div>
          <div class="todo-panel__dot"></div>
        </div>
      </div>
      <template v-else>
        <!-- 空态 -->
        <div v-if="!store.currentCategoryId" class="todo-panel__empty">
          <div class="todo-panel__empty-icon">📋</div>
          <div class="todo-panel__empty-text">请选择或创建一个分类</div>
        </div>
        <div v-else-if="store.tasks.length === 0" class="todo-panel__empty">
          <div class="todo-panel__empty-icon">✨</div>
          <div class="todo-panel__empty-text">暂无任务，快去添加一个吧~</div>
        </div>

        <!-- 卡片列表 -->
        <div v-else class="todo-panel__cards">
          <TodoItem v-for="task in store.tasks" :key="task.id" :task="task" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  background: $bg-primary;
  overflow: hidden;
}

// ─── 顶栏 ──────────────────────────────────
.todo-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-lg $spacing-xl;
  background: linear-gradient(135deg, rgba($bg-sidebar, 0.35) 0%, rgba($bg-sidebar, 0.15) 100%);
  border-bottom: 1px solid $border-subtle;
}

.todo-panel__title {
  font-size: $font-xl;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: 0.5px;
}

.todo-panel__actions {
  display: flex;
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

// ─── 列表区域 — 浅蓝灰衬底 ──────────────────
.todo-panel__body {
  flex: 1;
  overflow-y: auto;
  background: $bg-deep;
}

// 卡片容器 — grid 间距
.todo-panel__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 32px;
}

// ─── 空态 ──────────────────────────────────
.todo-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 240px;
  gap: $spacing-md;
}

.todo-panel__empty-icon {
  font-size: 36px;
  opacity: 0.5;
}

.todo-panel__empty-text {
  font-size: $font-sm;
  color: $text-muted;
}

// ─── 加载态 ────────────────────────────────
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

  &:nth-child(2) { animation-delay: 0.15s; }
  &:nth-child(3) { animation-delay: 0.3s; }
}

@keyframes dot-bounce {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-8px);
    opacity: 1;
  }
}
</style>
