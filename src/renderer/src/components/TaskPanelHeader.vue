<script setup lang="ts">
import { ref } from 'vue'
import TodoSearchBar from './TodoSearchBar.vue'

defineProps<{
  title: string
  hasTaskScope: boolean
  pendingCount: number
  isReordering: boolean
  completedCount: number
  isArchivingCompleted: boolean
  archiveTitle: string
  archiveLabel: string
}>()

const emit = defineEmits<{
  archiveCompleted: []
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })
const searchExpanded = defineModel<boolean>('searchExpanded', { default: false })
const searchBar = ref<{ focusSearch: () => void } | null>(null)

function focusSearch() {
  searchBar.value?.focusSearch()
}

defineExpose({
  focusSearch
})
</script>

<template>
  <header class="task-panel-header">
    <div class="task-panel-header__title-group">
      <h1 class="task-panel-header__title">
        {{ title }}
      </h1>
      <TodoSearchBar
        v-if="hasTaskScope"
        ref="searchBar"
        v-model="searchQuery"
        v-model:expanded="searchExpanded"
      />
    </div>
    <div class="task-panel-header__actions">
      <span v-if="hasTaskScope" class="task-panel-header__badge">
        <span class="task-panel-header__badge-num">
          {{ pendingCount }}
        </span>
        <span class="task-panel-header__badge-label">待办</span>
      </span>
      <span v-if="isReordering" class="task-panel-header__status">排序保存中...</span>
      <button
        v-if="hasTaskScope"
        :disabled="completedCount === 0 || isArchivingCompleted"
        class="task-panel-header__clear-btn"
        :title="archiveTitle"
        @click="emit('archiveCompleted')"
      >
        {{ isArchivingCompleted ? '归档中...' : archiveLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.task-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-lg;
  padding: $spacing-lg $spacing-xl;
  background: linear-gradient(135deg, rgba($bg-sidebar, 0.35) 0%, rgba($bg-sidebar, 0.15) 100%);
  border-bottom: 1px solid $border-subtle;
}

.task-panel-header__title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-panel-header__title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-xl;
  font-weight: 700;
  color: $text-primary;
  white-space: nowrap;
}

.task-panel-header__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: $spacing-md;
}

.task-panel-header__badge {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: $spacing-xs $spacing-md;
  background: $accent-soft;
  border-radius: 20px;
}

.task-panel-header__badge-num {
  font-size: $font-lg;
  font-weight: 700;
  color: $accent-color;
}

.task-panel-header__badge-label {
  font-size: $font-xs;
  color: $text-muted;
}

.task-panel-header__status {
  font-size: $font-xs;
  color: $text-muted;
}

.task-panel-header__clear-btn {
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
</style>
