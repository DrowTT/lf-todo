<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef } from 'vue'
import { Search, X } from 'lucide-vue-next'

interface Props {
  disabled?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: '搜索当前分类中的待办...'
})

const query = defineModel<string>({ default: '' })
const expanded = defineModel<boolean>('expanded', { default: false })
const SEARCH_EXPAND_FOCUS_DELAY_MS = 240

const searchInput = useTemplateRef<HTMLInputElement>('searchInput')
const hasQuery = computed(() => query.value.trim().length > 0)
const isInputInteractive = ref(false)
const inputActive = computed(() => expanded.value && isInputInteractive.value)
let focusTimer: ReturnType<typeof setTimeout> | null = null

function clearFocusTimer() {
  if (!focusTimer) return
  clearTimeout(focusTimer)
  focusTimer = null
}

onUnmounted(() => {
  clearFocusTimer()
})

function focusSearchInput(selectText = true) {
  isInputInteractive.value = true
  searchInput.value?.focus()

  if (selectText) {
    searchInput.value?.select()
  }
}

function scheduleSearchFocus() {
  clearFocusTimer()
  focusTimer = setTimeout(() => {
    focusSearchInput()
    focusTimer = null
  }, SEARCH_EXPAND_FOCUS_DELAY_MS)
}

function focusSearch() {
  if (props.disabled) return

  if (expanded.value) {
    clearFocusTimer()
    focusSearchInput()
    return
  }

  expanded.value = true
  isInputInteractive.value = false
  scheduleSearchFocus()
}

function openSearch() {
  focusSearch()
}

function clearQuery() {
  query.value = ''
  searchInput.value?.focus()
}

function collapseIfEmpty() {
  if (hasQuery.value) return
  clearFocusTimer()
  isInputInteractive.value = false
  expanded.value = false
}

function handleEscape() {
  if (hasQuery.value) {
    clearQuery()
    return
  }

  clearFocusTimer()
  isInputInteractive.value = false
  expanded.value = false
  searchInput.value?.blur()
}

defineExpose({
  focusSearch
})
</script>

<template>
  <div
    class="todo-search"
    :class="{
      'todo-search--expanded': expanded,
      'todo-search--interactive': inputActive,
      'todo-search--disabled': disabled
    }"
  >
    <button
      type="button"
      class="todo-search__trigger"
      :disabled="disabled"
      :aria-label="expanded ? '搜索当前分类' : '展开分类内搜索'"
      @mousedown.prevent
      @click="openSearch"
    >
      <Search :size="15" />
    </button>

    <input
      ref="searchInput"
      v-model="query"
      type="text"
      class="todo-search__input"
      :placeholder="placeholder"
      :disabled="disabled"
      @blur="collapseIfEmpty"
      @keydown.escape.prevent="handleEscape"
    />

    <button
      v-if="expanded && hasQuery"
      type="button"
      class="todo-search__clear"
      aria-label="清空搜索"
      @mousedown.prevent
      @click="clearQuery"
    >
      <X :size="14" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.todo-search {
  --collapsed-size: 36px;
  --expanded-max-size: 320px;
  --expand-duration: 0.34s;
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 1 1 var(--collapsed-size);
  width: 100%;
  min-width: var(--collapsed-size);
  max-width: var(--collapsed-size);
  height: var(--collapsed-size);
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid rgba($border-light, 0.7);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba($bg-elevated, 0.98), rgba($bg-elevated, 0.92)),
    rgba($bg-elevated, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 8px 18px rgba(15, 23, 42, 0.04);
  transition:
    max-width var(--expand-duration) cubic-bezier(0.22, 1, 0.36, 1),
    padding var(--expand-duration) cubic-bezier(0.22, 1, 0.36, 1),
    border-color $transition-normal,
    box-shadow $transition-normal,
    background-color $transition-normal;

  &:hover:not(.todo-search--disabled) {
    border-color: rgba($accent-color, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.96),
      0 10px 22px rgba(15, 23, 42, 0.05);
  }

  &:focus-within {
    border-color: rgba($accent-color, 0.34);
    box-shadow:
      inset 0 0 0 1px rgba($accent-color, 0.18),
      0 12px 24px rgba(37, 99, 235, 0.08);
  }

  &--expanded {
    max-width: var(--expanded-max-size);
    padding-right: 10px;
  }

  &--disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.todo-search__trigger,
.todo-search__clear {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: $text-muted;
  line-height: 0;
  transition:
    color $transition-normal,
    background-color $transition-normal,
    transform $transition-fast;

  &:disabled {
    cursor: not-allowed;
  }
}

.todo-search__trigger {
  width: 36px;
  height: 36px;
  cursor: pointer;

  :deep(svg) {
    transform: translateX(-1px);
  }

  .todo-search:hover:not(.todo-search--disabled) &,
  .todo-search:focus-within & {
    color: $accent-color;
  }
}

.todo-search__input {
  min-width: 0;
  flex: 1 1 auto;
  width: auto;
  height: 100%;
  margin-left: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: $text-primary;
  font-size: $font-sm;
  line-height: 36px;
  outline: none;
  opacity: 0;
  pointer-events: none;
  transform: translateX(6px);
  transition:
    margin-left var(--expand-duration) cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.22s ease,
    transform var(--expand-duration) cubic-bezier(0.22, 1, 0.36, 1);

  &::placeholder {
    color: $text-muted;
  }

  .todo-search--expanded & {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
  }
}

.todo-search__clear {
  margin-left: 6px;
  cursor: pointer;

  &:hover {
    color: $text-primary;
    background: rgba($accent-color, 0.08);
  }

  &:active {
    transform: scale(0.92);
  }
}
</style>
