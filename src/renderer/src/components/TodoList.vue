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
          {{ store.pendingCounts[store.currentCategoryId] ?? 0 }} 待办
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
        <span class="todo-list__spinner" />
      </div>
      <template v-else>
        <div v-if="!store.currentCategoryId" class="todo-list__empty">请选择或创建一个分类</div>
        <div v-else-if="store.tasks.length === 0" class="todo-list__empty">
          暂无任务,快去添加一个吧~
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
    padding: $spacing-md $spacing-lg;
    border-bottom: 1px solid $border-color;
  }

  &__title {
    font-size: $font-lg;
    font-weight: 500;
    color: $text-primary;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $spacing-md;
  }

  &__count {
    font-size: $font-xs;
    color: $text-muted;
  }

  &__clear-btn {
    padding: $spacing-xs $spacing-sm;
    background: transparent;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    font-size: $font-xs;
    color: $text-secondary;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover:not(:disabled) {
      border-color: $danger-color;
      color: $danger-color;
      background: rgba($danger-color, 0.1);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      color: $text-muted;
    }
  }

  &__content {
    flex: 1;
    overflow-y: auto;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    font-size: $font-sm;
    color: $text-muted;
  }

  // UX3：loading 占位层
  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
  }

  // UX3：旋转 spinner
  &__spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid $border-color;
    border-top-color: $accent-color;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
