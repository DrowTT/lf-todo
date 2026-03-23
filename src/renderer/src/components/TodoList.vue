<script setup lang="ts">
import { store } from '../store'
import TodoInput from './TodoInput.vue'
import TodoItem from './TodoItem.vue'
import { computed } from 'vue'
import { useConfirm } from '../composables/useConfirm'
import { ClipboardList, Sparkles } from 'lucide-vue-next'

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
        <!-- 空态：未选择分类 -->
        <div v-if="!store.currentCategoryId" class="todo-panel__empty">
          <div class="todo-panel__empty-glow">
            <ClipboardList class="todo-panel__empty-svg" :size="32" />
          </div>
          <div class="todo-panel__empty-title">请选择或创建一个分类</div>
          <div class="todo-panel__empty-hint">在左侧添加分类后即可开始管理待办</div>
        </div>
        <!-- 空态：无任务 -->
        <div v-else-if="store.tasks.length === 0" class="todo-panel__empty">
          <div class="todo-panel__empty-glow todo-panel__empty-glow--spark">
            <Sparkles class="todo-panel__empty-svg" :size="32" />
          </div>
          <div class="todo-panel__empty-title">暂无任务</div>
          <div class="todo-panel__empty-hint">在上方输入框添加你的第一个待办吧</div>
        </div>

        <!-- 卡片列表 — TransitionGroup 提供添加/删除过渡 -->
        <TransitionGroup
          v-else
          name="card-list"
          tag="div"
          class="todo-panel__cards"
        >
          <TodoItem v-for="task in store.tasks" :key="task.id" :task="task" />
        </TransitionGroup>
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
  // 预留滚动条槽位，避免出现/消失时内容宽度突变
  scrollbar-gutter: stable;
  background: $bg-deep;
}

// 卡片容器 — grid 间距
.todo-panel__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 32px;
}

// ─── 空态（重新设计） ─────────────────────────
.todo-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 280px;
  gap: $spacing-md;
  animation: empty-fade-in 0.5s ease;
}

// 图标发光容器
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

  // Sparkles 变体 — 暖色调
  &--spark {
    background: linear-gradient(135deg, rgba($warning-color, 0.1) 0%, rgba($warning-color, 0.04) 100%);
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

// ─── TransitionGroup 动画 — 卡片添加/删除/移动 ──
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
