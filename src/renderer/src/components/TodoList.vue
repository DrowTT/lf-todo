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

// 优化 #9：统一数据源为 pendingCounts，与侧栏 badge 保持一致，消除数字闪烁

const handleClearCompleted = async () => {
  const confirmed = await confirm(`确认删除 ${completedCount.value} 个已完成的待办吗?`)
  if (confirmed) {
    store.clearCompletedTasks()
  }
}
</script>

<template>
  <div class="todo-list">
    <!-- Header -->
    <div class="todo-list__header">
      <h1 class="todo-list__title">
        {{ currentCategoryName }}
      </h1>
      <div class="todo-list__actions">
        <span class="todo-list__count" v-if="store.currentCategoryId">
          <span class="todo-list__count-num">{{ store.pendingCounts[store.currentCategoryId] ?? 0 }}</span>
          <span class="todo-list__count-label">待办</span>
        </span>
        <button
          v-if="store.currentCategoryId"
          @click="handleClearCompleted"
          :disabled="completedCount === 0"
          class="todo-list__clear-btn"
          title="清空已完成"
        >
          清空已完成 ({{ completedCount }})
        </button>
      </div>
    </div>

    <!-- Input -->
    <TodoInput v-if="store.currentCategoryId" />

    <!-- List -->
    <div class="todo-list__content">
      <!-- UX3：切换分类期间显示 loading 预占位层 -->
      <div v-if="store.isLoading" class="todo-list__loading">
        <div class="todo-list__spinner">
          <div class="todo-list__spinner-dot"></div>
          <div class="todo-list__spinner-dot"></div>
          <div class="todo-list__spinner-dot"></div>
        </div>
      </div>
      <template v-else>
        <div v-if="!store.currentCategoryId" class="todo-list__empty">
          <div class="todo-list__empty-icon">📋</div>
          <div class="todo-list__empty-text">请选择或创建一个分类</div>
        </div>
        <div v-else-if="store.tasks.length === 0" class="todo-list__empty">
          <div class="todo-list__empty-icon">✨</div>
          <div class="todo-list__empty-text">暂无任务，快去添加一个吧~</div>
        </div>
        <div v-else>
          <TodoItem v-for="task in store.tasks" :key="task.id" :task="task" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  background: $bg-primary;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-lg $spacing-xl;
    background: rgba($bg-sidebar, 0.3);
  }

  &__title {
    font-size: $font-xl;
    font-weight: 600;
    color: $text-primary;
    letter-spacing: 0.3px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $spacing-md;
  }

  &__count {
    display: flex;
    align-items: baseline;
    gap: 3px;
    padding: $spacing-xs $spacing-md;
    background: $accent-soft;
    border-radius: 12px;
  }

  &__count-num {
    font-size: $font-lg;
    font-weight: 600;
    color: $accent-color;
  }

  &__count-label {
    font-size: $font-xs;
    color: $text-muted;
  }

  &__clear-btn {
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
      background: rgba($danger-color, 0.08);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-xs 0;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 240px;
    gap: $spacing-md;
  }

  &__empty-icon {
    font-size: 32px;
    opacity: 0.6;
  }

  &__empty-text {
    font-size: $font-sm;
    color: $text-muted;
  }

  // Loading 动画 — 三点弹跳
  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
  }

  &__spinner {
    display: flex;
    gap: 6px;
  }

  &__spinner-dot {
    width: 8px;
    height: 8px;
    background: $accent-color;
    border-radius: 50%;
    animation: bounce 1.2s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.15s;
    }

    &:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
}

@keyframes bounce {
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
