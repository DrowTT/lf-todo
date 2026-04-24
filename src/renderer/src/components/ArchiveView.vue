<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ArchivedTaskGroup, Category } from '../../../shared/types/models'
import { Archive, CheckSquare, RotateCcw } from 'lucide-vue-next'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { FOCUS_SEARCH_EVENT } from '../composables/useHotkeys'
import { useArchiveStore } from '../store/archive'
import { normalizeCategoryName } from '../utils/quickAdd'
import ArchivedTodoItem from './ArchivedTodoItem.vue'
import TodoSearchBar from './TodoSearchBar.vue'

const app = useAppFacade()
const archiveStore = useArchiveStore()
const { toast } = useAppRuntime()

const searchQuery = ref('')
const isSearchExpanded = ref(false)
const searchBar = ref<{ focusSearch: () => void } | null>(null)
const restoringIds = ref<number[]>([])

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const hasSearch = computed(() => normalizedSearchQuery.value.length > 0)
const filteredGroups = computed(() => {
  if (!hasSearch.value) {
    return archiveStore.groups
  }

  return archiveStore.groups.filter((group) => {
    if (group.task.content.toLocaleLowerCase().includes(normalizedSearchQuery.value)) {
      return true
    }

    return group.subTasks.some((subTask) =>
      subTask.content.toLocaleLowerCase().includes(normalizedSearchQuery.value)
    )
  })
})
const visibleIds = computed(() => filteredGroups.value.map((group) => group.task.id))
const selectedVisibleCount = computed(
  () => visibleIds.value.filter((id) => archiveStore.isSelected(id)).length
)
const areAllVisibleSelected = computed(
  () => visibleIds.value.length > 0 && selectedVisibleCount.value === visibleIds.value.length
)
const selectedCount = computed(() => archiveStore.selectedCount)

function resolveRestoredCategoryId(group: ArchivedTaskGroup, categories: Category[]) {
  const directCategory = categories.find((category) => category.id === group.task.category_id)
  if (directCategory) {
    return directCategory.id
  }

  const archivedCategoryName = group.task.archived_category_name?.trim()
  if (!archivedCategoryName) {
    return null
  }

  const normalizedArchivedCategoryName = normalizeCategoryName(archivedCategoryName)
  return (
    categories.find(
      (category) => normalizeCategoryName(category.name) === normalizedArchivedCategoryName
    )?.id ?? null
  )
}

function handleFocusSearchRequested() {
  searchBar.value?.focusSearch()
}

function toggleSelectAllVisible() {
  const shouldSelect = !areAllVisibleSelected.value
  visibleIds.value.forEach((id) => archiveStore.toggleSelected(id, shouldSelect))
}

async function handleRestore(ids: number[]) {
  if (ids.length === 0) {
    return
  }

  const restoredGroup =
    ids.length === 1
      ? (archiveStore.groups.find((group) => group.task.id === ids[0]) ?? null)
      : null
  restoringIds.value = [...new Set([...restoringIds.value, ...ids])]

  try {
    const restoredCount = await app.restoreArchivedTasks(ids)

    if (!restoredGroup || restoredCount !== 1) {
      return
    }

    const restoredCategoryId = resolveRestoredCategoryId(restoredGroup, app.categories.value)
    if (!restoredCategoryId) {
      toast.show('待办已取消归档', 'success')
      return
    }

    toast.show('待办已取消归档', 'success', {
      actionLabel: '立即查看',
      onAction: () => {
        void (async () => {
          try {
            await app.revealTask(restoredGroup.task.id, restoredCategoryId)
          } catch (error) {
            console.error('[ArchiveView] reveal restored task failed', error)
            toast.show('跳转任务失败，请稍后重试')
          }
        })()
      },
      duration: 5000
    })
  } finally {
    const restoringSet = new Set(restoringIds.value)
    ids.forEach((id) => restoringSet.delete(id))
    restoringIds.value = [...restoringSet]
  }
}

async function handleRestoreSelected() {
  await handleRestore([...archiveStore.selectedIds])
}

function isRestoring(id: number) {
  return restoringIds.value.includes(id)
}

onMounted(() => {
  window.addEventListener(FOCUS_SEARCH_EVENT, handleFocusSearchRequested)
  if (archiveStore.groups.length === 0) {
    void app.fetchArchivedTaskGroups()
  }
})

onUnmounted(() => {
  window.removeEventListener(FOCUS_SEARCH_EVENT, handleFocusSearchRequested)
})
</script>

<template>
  <div class="archive-panel">
    <header class="archive-panel__header">
      <div class="archive-panel__title-group">
        <h1 class="archive-panel__title">已归档待办</h1>
        <TodoSearchBar ref="searchBar" v-model="searchQuery" v-model:expanded="isSearchExpanded" />
      </div>

      <div class="archive-panel__actions">
        <span class="archive-panel__badge">
          <span class="archive-panel__badge-num">{{ archiveStore.groups.length }}</span>
          <span class="archive-panel__badge-label">已归档</span>
        </span>

        <button
          v-if="filteredGroups.length > 0"
          class="archive-panel__secondary-btn"
          @click="toggleSelectAllVisible"
        >
          <CheckSquare :size="13" />
          {{ areAllVisibleSelected ? '清空当前选择' : '全选当前结果' }}
        </button>

        <button
          class="archive-panel__primary-btn"
          :disabled="selectedCount === 0 || archiveStore.isRestoring"
          @click="handleRestoreSelected"
        >
          <RotateCcw :size="13" />
          {{ archiveStore.isRestoring ? '恢复中...' : `恢复选中 (${selectedCount})` }}
        </button>
      </div>
    </header>

    <div class="archive-panel__body">
      <div v-if="archiveStore.isLoading" class="archive-panel__empty">
        <div class="archive-panel__empty-glow">
          <Archive :size="28" />
        </div>
        <div class="archive-panel__empty-title">正在加载已归档待办</div>
        <div class="archive-panel__empty-hint">稍等一下，历史任务马上就好</div>
      </div>

      <div v-else-if="archiveStore.groups.length === 0" class="archive-panel__empty">
        <div class="archive-panel__empty-glow">
          <Archive :size="28" />
        </div>
        <div class="archive-panel__empty-title">暂无已归档待办</div>
        <div class="archive-panel__empty-hint">已归档的完成任务会在这里沉淀下来</div>
      </div>

      <div v-else-if="filteredGroups.length === 0" class="archive-panel__empty">
        <div class="archive-panel__empty-glow">
          <Archive :size="28" />
        </div>
        <div class="archive-panel__empty-title">没有匹配结果</div>
        <div class="archive-panel__empty-hint">试试更短的关键词，或者换一个说法</div>
      </div>

      <div v-else class="archive-panel__cards">
        <ArchivedTodoItem
          v-for="group in filteredGroups"
          :key="group.task.id"
          :group="group"
          :highlight-query="searchQuery"
          :selected="archiveStore.isSelected(group.task.id)"
          :restoring="isRestoring(group.task.id)"
          @toggle-select="archiveStore.toggleSelected(group.task.id, $event)"
          @restore="void handleRestore([group.task.id])"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.archive-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  min-width: 0;
  background: $bg-primary;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-lg;
    padding: $spacing-lg $spacing-xl;
    background: linear-gradient(135deg, rgba($bg-sidebar, 0.35) 0%, rgba($bg-sidebar, 0.15) 100%);
    border-bottom: 1px solid $border-subtle;
  }

  &__title-group {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__title {
    margin: 0;
    font-size: $font-xl;
    font-weight: 700;
    color: $text-primary;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  &__badge {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    padding: $spacing-xs $spacing-md;
    background: rgba($accent-color, 0.08);
    border-radius: 20px;
  }

  &__badge-num {
    font-size: $font-lg;
    font-weight: 700;
    color: $accent-color;
  }

  &__badge-label {
    font-size: $font-xs;
    color: $text-muted;
  }

  &__secondary-btn,
  &__primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: $font-xs;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  &__secondary-btn {
    border: 1px solid $border-light;
    background: transparent;
    color: $text-secondary;

    &:hover:not(:disabled) {
      border-color: rgba($accent-color, 0.22);
      color: $accent-color;
      background: rgba($accent-color, 0.06);
    }
  }

  &__primary-btn {
    border: 1px solid rgba($accent-color, 0.2);
    background: $accent-soft;
    color: $accent-color;

    &:hover:not(:disabled) {
      border-color: rgba($accent-color, 0.38);
      background: rgba($accent-color, 0.12);
    }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    background: $bg-deep;
  }

  &__cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px 32px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    gap: $spacing-md;
  }

  &__empty-glow {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
    background: linear-gradient(
      135deg,
      rgba($accent-color, 0.08) 0%,
      rgba($accent-color, 0.04) 100%
    );
    border: 1px solid rgba($accent-color, 0.1);
    color: $accent-color;
  }

  &__empty-title {
    font-size: $font-lg;
    font-weight: 600;
    color: $text-secondary;
  }

  &__empty-hint {
    font-size: $font-sm;
    color: $text-muted;
  }
}
</style>
