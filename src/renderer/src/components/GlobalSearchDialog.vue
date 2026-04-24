<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { CheckCircle2, Command, FolderSearch, Loader2, Search } from 'lucide-vue-next'
import type { Task } from '../../../shared/types/models'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useGlobalSearchStore, type GlobalSearchScope } from '../store/globalSearch'
import { buildSearchHighlightParts, buildSearchSnippet } from '../utils/searchHighlight'
import { getCategoryDisplayName } from '../utils/taskNavigation'
import { formatTaskDueLabel, hasTaskDue } from '../utils/taskDue'

const SEARCH_DEBOUNCE_MS = 140
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

const app = useAppFacade()
const globalSearchStore = useGlobalSearchStore()

const { categories, currentCategoryId } = storeToRefs(app.categoryStore)
const { isOpen, query, scope, results, isLoading, selectedIndex, selectedTask } =
  storeToRefs(globalSearchStore)

const inputRef = ref<HTMLInputElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const listboxId = 'global-search-listbox'
const descriptionId = 'global-search-description'

const currentCategory = computed(
  () => categories.value.find((category) => category.id === currentCategoryId.value) ?? null
)
const isAllTasksView = computed(() => app.isAllTasksView.value)
const currentCategoryLabel = computed(
  () => getCategoryDisplayName(currentCategory.value) || '未选择分类'
)
const currentScopeLabel = computed(() =>
  isAllTasksView.value ? '当前视图（全部）' : `当前分类 · ${currentCategoryLabel.value}`
)
const activeDescendantId = computed(() =>
  selectedTask.value ? `global-search-option-${selectedTask.value.id}` : undefined
)
const scopeOptions = computed<{ value: GlobalSearchScope; label: string; disabled: boolean }[]>(
  () => [
    {
      value: 'current',
      label: currentScopeLabel.value,
      disabled: currentCategoryId.value === null || isAllTasksView.value
    },
    {
      value: 'all',
      label: '全部任务',
      disabled: false
    }
  ]
)
const panelHint = computed(() => {
  if (!query.value.trim()) {
    if (scope.value === 'current') {
      return `正在“${currentCategoryLabel.value}”中搜索`
    }

    if (isAllTasksView.value) {
      return '当前位于“全部”视图，将在所有任务中搜索'
    }

    return '正在全部任务中搜索'
  }

  if (isLoading.value) {
    return '正在查找匹配任务...'
  }

  if (results.value.length === 0) {
    return '没有匹配结果'
  }

  return `找到 ${results.value.length} 条结果`
})

const getTaskDescription = (task: Task) => task.description?.trim() ?? ''
const getTaskDescriptionPreview = (task: Task) => buildSearchSnippet(getTaskDescription(task), query.value)
const shouldShowDescription = (task: Task) => Boolean(getTaskDescription(task))
const getSubTaskMatchPreviews = (task: Task) =>
  (task.search_subtask_matches ?? []).map((content) => buildSearchSnippet(content, query.value, 28))
const shouldShowSubTaskMatches = (task: Task) => getSubTaskMatchPreviews(task).length > 0

let searchTimer: ReturnType<typeof setTimeout> | null = null
let restoreFocusTarget: HTMLElement | null = null

function clearSearchTimer() {
  if (!searchTimer) return
  clearTimeout(searchTimer)
  searchTimer = null
}

function focusInput() {
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function focusPanel() {
  panelRef.value?.focus()
}

function isFocusableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(FOCUSABLE_SELECTOR)
}

function getFocusableElements() {
  if (!panelRef.value) {
    return []
  }

  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true'
  )
}

async function runSearch() {
  const normalizedQuery = query.value.trim()
  if (!normalizedQuery) {
    await globalSearchStore.search({ query: '', categoryId: null })
    return
  }

  const categoryId =
    scope.value === 'current' && currentCategoryId.value !== null && !isAllTasksView.value
      ? currentCategoryId.value
      : null

  await globalSearchStore.search({
    query: normalizedQuery,
    categoryId
  })
}

function scheduleSearch() {
  clearSearchTimer()

  if (!isOpen.value) {
    return
  }

  if (!query.value.trim()) {
    void globalSearchStore.search({ query: '', categoryId: null })
    return
  }

  searchTimer = setTimeout(() => {
    void runSearch()
    searchTimer = null
  }, SEARCH_DEBOUNCE_MS)
}

function restoreFocus() {
  restoreFocusTarget?.focus()
  restoreFocusTarget = null
}

function getDueLabel(task: Task): string {
  return hasTaskDue(task) ? formatTaskDueLabel(task) : ''
}

function getTaskCategoryLabel(task: Task): string {
  const category = categories.value.find((item) => item.id === task.category_id)
  return getCategoryDisplayName(category) || '未知分类'
}

function closeDialog() {
  globalSearchStore.close()
  restoreFocus()
}

async function activateTask(task: Task) {
  globalSearchStore.close()
  restoreFocusTarget = null
  await app.revealTask(task.id, task.category_id)
  await nextTick()
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    event.stopPropagation()
    globalSearchStore.moveSelection(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()
    globalSearchStore.moveSelection(-1)
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    event.stopPropagation()
    globalSearchStore.moveSelectionToEdge('start')
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    event.stopPropagation()
    globalSearchStore.moveSelectionToEdge('end')
    return
  }

  if (event.key === 'Enter') {
    if (!selectedTask.value) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    void activateTask(selectedTask.value)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeDialog()
  }
}

function handlePanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeDialog()
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const focusableElements = getFocusableElements()

  if (focusableElements.length === 0) {
    event.preventDefault()
    focusInput()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const isFocusInsidePanel = !!activeElement && !!panelRef.value?.contains(activeElement)

  if (event.shiftKey) {
    if (!isFocusInsidePanel || activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    }
    return
  }

  if (!isFocusInsidePanel || activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

function handlePanelMouseDown(event: MouseEvent) {
  if (isFocusableTarget(event.target)) {
    return
  }

  focusPanel()
}

function handleScopeChange(nextScope: GlobalSearchScope) {
  globalSearchStore.setScope(nextScope, {
    currentCategoryId: currentCategoryId.value,
    isAllTasksView: isAllTasksView.value
  })
  focusInput()
}

watch(isOpen, (opened) => {
  if (opened) {
    restoreFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
    focusInput()
    scheduleSearch()
    return
  }

  clearSearchTimer()
})

watch([isOpen, isAllTasksView, currentCategoryId], ([opened, allTasksView, categoryId]) => {
  if (!opened) {
    return
  }

  globalSearchStore.setScope(scope.value, {
    currentCategoryId: categoryId,
    isAllTasksView: allTasksView
  })
})

watch([isOpen, query, scope, currentCategoryId, isAllTasksView], () => {
  scheduleSearch()
})

watch(selectedTask, (task) => {
  if (!task) return

  nextTick(() => {
    const option = document.getElementById(`global-search-option-${task.id}`)
    option?.scrollIntoView({
      block: 'nearest'
    })
  })
})

onBeforeUnmount(() => {
  clearSearchTimer()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="global-search-backdrop">
      <div v-if="isOpen" class="global-search__backdrop" aria-hidden="true" @click="closeDialog"></div>
    </Transition>

    <Transition name="global-search-panel">
      <div v-if="isOpen" class="global-search" @click.self="closeDialog">
        <div
          ref="panelRef"
          class="global-search__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-search-title"
          :aria-describedby="descriptionId"
          tabindex="-1"
          @click.stop
          @mousedown.capture="handlePanelMouseDown"
          @keydown="handlePanelKeydown"
        >
          <div class="global-search__header">
            <div class="global-search__headline">
              <div class="global-search__icon-wrap">
                <Search :size="16" />
              </div>
              <div class="global-search__headline-text">
                <h2 id="global-search-title" class="global-search__title">搜索任务</h2>
                <p :id="descriptionId" class="global-search__subtitle">
                  {{ panelHint }}
                </p>
              </div>
            </div>

            <div class="global-search__scope">
              <button
                v-for="option in scopeOptions"
                :key="option.value"
                type="button"
                class="global-search__scope-chip"
                :class="{ 'global-search__scope-chip--active': scope === option.value }"
                :disabled="option.disabled"
                @click="handleScopeChange(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="global-search__input-row">
            <Search class="global-search__input-icon" :size="16" />
            <input
              ref="inputRef"
              :value="query"
              type="text"
              class="global-search__input"
              placeholder="输入关键词搜索任务内容"
              role="combobox"
              :aria-expanded="results.length > 0"
              :aria-controls="listboxId"
              :aria-activedescendant="activeDescendantId"
              aria-autocomplete="list"
              @input="globalSearchStore.setQuery(($event.target as HTMLInputElement).value)"
              @keydown="handleInputKeydown"
            />
            <div class="global-search__shortcut">
              <Command :size="12" />
              <span>Esc 关闭</span>
            </div>
          </div>

          <div class="global-search__body">
            <div v-if="!query.trim()" class="global-search__placeholder">
              <FolderSearch :size="20" />
              <span>输入关键词后开始搜索，可用方向键选择结果</span>
            </div>

            <div v-else-if="isLoading" class="global-search__placeholder">
              <Loader2 class="global-search__spin" :size="18" />
              <span>正在搜索...</span>
            </div>

            <div v-else-if="results.length === 0" class="global-search__placeholder">
              <Search :size="18" />
              <span>没有找到匹配任务，试试更短的关键词</span>
            </div>

            <ul v-else :id="listboxId" class="global-search__list" role="listbox" aria-label="搜索结果">
              <li
                v-for="(task, index) in results"
                :id="`global-search-option-${task.id}`"
                :key="task.id"
                class="global-search__option"
                :class="{ 'global-search__option--active': index === selectedIndex }"
                role="option"
                :aria-selected="index === selectedIndex"
                @mousedown.prevent
                @mouseenter="globalSearchStore.selectIndex(index)"
                @click="void activateTask(task)"
              >
                <div class="global-search__option-main">
                  <div class="global-search__option-title">
                    <template
                      v-for="(part, partIndex) in buildSearchHighlightParts(task.content, query)"
                      :key="`${task.id}-${partIndex}`"
                    >
                      <mark v-if="part.matched" class="global-search__mark">{{ part.text }}</mark>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </div>
                  <div v-if="shouldShowDescription(task)" class="global-search__option-description">
                    <template
                      v-for="(part, partIndex) in buildSearchHighlightParts(getTaskDescriptionPreview(task), query)"
                      :key="`${task.id}-desc-${partIndex}`"
                    >
                      <mark v-if="part.matched" class="global-search__mark">{{ part.text }}</mark>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </div>
                  <div
                    v-if="shouldShowSubTaskMatches(task)"
                    class="global-search__option-subtasks"
                  >
                    <div
                      v-for="(subTaskPreview, subTaskIndex) in getSubTaskMatchPreviews(task)"
                      :key="`${task.id}-subtask-${subTaskIndex}`"
                      class="global-search__option-subtask"
                    >
                      <span class="global-search__subtask-prefix">子</span>
                      <span class="global-search__subtask-text">
                        <template
                          v-for="(part, partIndex) in buildSearchHighlightParts(subTaskPreview, query)"
                          :key="`${task.id}-subtask-${subTaskIndex}-${partIndex}`"
                        >
                          <mark v-if="part.matched" class="global-search__mark">{{ part.text }}</mark>
                          <span v-else>{{ part.text }}</span>
                        </template>
                      </span>
                    </div>
                  </div>
                  <div class="global-search__option-meta">
                    <span class="global-search__meta-chip">
                      {{ getTaskCategoryLabel(task) }}
                    </span>
                    <span v-if="task.is_completed" class="global-search__meta-chip">
                      <CheckCircle2 :size="12" />
                      已完成
                    </span>
                    <span v-if="getDueLabel(task)" class="global-search__meta-chip">
                      {{ getDueLabel(task) }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.global-search {
  position: fixed;
  inset: 0;
  z-index: 401;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 72px 20px 20px;
}

.global-search__backdrop {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.global-search__panel {
  position: relative;
  width: min(720px, 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba($border-light, 0.75);
  border-radius: 22px;
  background: rgba($bg-elevated, 0.96);
  box-shadow:
    0 28px 60px rgba(15, 23, 42, 0.18),
    0 8px 18px rgba(15, 23, 42, 0.08);

  &:focus {
    outline: none;
  }
}

.global-search__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 12px;
  border-bottom: 1px solid $border-subtle;
}

.global-search__headline {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.global-search__icon-wrap {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: $accent-color;
  background: linear-gradient(135deg, rgba($accent-color, 0.12), rgba($accent-color, 0.04));
}

.global-search__headline-text {
  min-width: 0;
}

.global-search__title {
  margin: 0;
  font-size: $font-lg;
  color: $text-primary;
}

.global-search__subtitle {
  margin: 4px 0 0;
  font-size: $font-xs;
  color: $text-muted;
}

.global-search__scope {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.global-search__scope-chip {
  padding: 7px 12px;
  border: 1px solid $border-color;
  border-radius: 999px;
  background: rgba($bg-deep, 0.8);
  color: $text-secondary;
  font-size: $font-xs;
  font-weight: 600;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover:not(:disabled) {
    border-color: rgba($accent-color, 0.3);
    color: $text-primary;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.global-search__scope-chip--active {
  border-color: rgba($accent-color, 0.24);
  background: $accent-soft;
  color: $accent-color;
}

.global-search__input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid $border-subtle;
}

.global-search__input-icon {
  flex-shrink: 0;
  color: $text-muted;
}

.global-search__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: $text-primary;
  font-size: 15px;
  outline: none;

  &::placeholder {
    color: $text-muted;
  }
}

.global-search__shortcut {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba($border-light, 0.8);
  border-radius: 999px;
  background: rgba($bg-deep, 0.72);
  color: $text-muted;
  font-size: 11px;
}

.global-search__body {
  min-height: 200px;
  max-height: 420px;
  overflow-y: auto;
}

.global-search__placeholder {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: $text-muted;
  font-size: $font-sm;
}

.global-search__list {
  margin: 0;
  padding: 8px;
  list-style: none;
}

.global-search__option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  cursor: pointer;
  transition: background-color $transition-fast;
}

.global-search__option + .global-search__option {
  margin-top: 4px;
}

.global-search__option--active {
  background: rgba($accent-color, 0.08);
}

.global-search__option-main {
  flex: 1;
  min-width: 0;
}

.global-search__option-title {
  color: $text-primary;
  font-size: $font-md;
  line-height: 1.6;
  word-break: break-word;
}

.global-search__option-description {
  display: -webkit-box;
  margin-top: 3px;
  color: rgba($text-secondary, 0.78);
  font-size: $font-sm;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.global-search__option-subtasks {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 5px;
}

.global-search__option-subtask {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  color: rgba($text-secondary, 0.76);
  font-size: $font-sm;
  line-height: 1.5;
}

.global-search__subtask-prefix {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba($accent-color, 0.08);
  color: rgba($accent-color, 0.82);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
}

.global-search__subtask-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search__option-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.global-search__meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba($bg-deep, 0.88);
  color: $text-muted;
  font-size: 11px;
}

.global-search__mark {
  padding: 0 2px;
  border-radius: 4px;
  background: rgba($warning-color, 0.18);
  color: $text-primary;
}

.global-search__spin {
  animation: global-search-spin 0.9s linear infinite;
}

.global-search-backdrop-enter-active {
  transition: background-color $transition-slow;
}

.global-search-backdrop-leave-active {
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.global-search-backdrop-enter-from {
  background-color: transparent;
}

.global-search-backdrop-leave-to {
  background-color: transparent;
  opacity: 0;
}

.global-search-panel-enter-active {
  transition: transform $transition-spring;
}

.global-search-panel-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.global-search-panel-enter-from {
  transform: translateY(12px) scale(0.97);
}

.global-search-panel-leave-to {
  transform: translateY(8px) scale(0.97);
  opacity: 0;
}

@keyframes global-search-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
