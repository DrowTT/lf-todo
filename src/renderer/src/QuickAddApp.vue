<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useAutoHeight } from './composables/useAutoHeight'
import { useQuickAddComposer } from './composables/useQuickAddComposer'

const QUICK_ADD_WINDOW_MIN_HEIGHT = 140

const composer = useQuickAddComposer()
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const { adjustHeight } = useAutoHeight(inputRef)

const placeholderText = computed(() =>
  composer.selectedCategory.value
    ? '输入待办内容，Enter 提交，Shift+Enter 换行'
    : composer.defaultCategory.value
      ? `直接输入待办，Enter 默认进入 #${composer.defaultCategory.value.name}`
      : '#工作 空格后继续输入待办'
)

const statusText = computed(() => {
  if (composer.errorMessage.value) {
    return composer.errorMessage.value
  }

  if (composer.isSubmitting.value) {
    return '正在添加待办...'
  }

  if (composer.isLoading.value) {
    return '正在加载分类...'
  }

  if (composer.selectedCategory.value) {
    return ''
  }

  if (!composer.categoryQuery.value) {
    if (composer.defaultCategory.value) {
      return `直接回车会保存到「${composer.defaultCategory.value.name}」，也可输入 #分类名 后按空格切换`
    }

    return '输入 #分类名 后按空格确认'
  }

  if (composer.resolution.value.kind === 'existing' && composer.resolution.value.category) {
    return `空格确认分类：${composer.resolution.value.category.name}`
  }

  if (composer.resolution.value.kind === 'create' && composer.resolution.value.name) {
    return `空格创建分类：${composer.resolution.value.name}`
  }

  if (composer.resolution.value.kind === 'ambiguous') {
    return '分类还不够精确，请继续输入'
  }

  return '输入 #分类名 后按空格确认'
})

const hasError = computed(() => composer.errorMessage.value.length > 0)

function focusInput(): void {
  const input = inputRef.value
  if (!input) {
    return
  }

  input.focus()
  const caret = input.value.length
  input.setSelectionRange(caret, caret)
}

function closeWindow(): void {
  window.api?.window?.close()
}

async function syncWindowHeight(): Promise<void> {
  await nextTick()
  adjustHeight()
  await nextTick()

  const root = rootRef.value
  if (!root) {
    return
  }

  window.api?.window?.resizeQuickAddWindow(
    Math.max(QUICK_ADD_WINDOW_MIN_HEIGHT, Math.ceil(root.scrollHeight))
  )
}

function restoreCategoryToDraft(): void {
  composer.clearSelectedCategory()
  requestAnimationFrame(focusInput)
  void syncWindowHeight()
}

async function handleSubmit(): Promise<void> {
  const result = await composer.submit()
  if (!result) {
    requestAnimationFrame(focusInput)
    return
  }

  closeWindow()
}

function handleInput(): void {
  adjustHeight()
}

function handleQuickAddSessionRequested(): void {
  void composer.prepareForSession()
  requestAnimationFrame(focusInput)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()

    if (composer.selectedCategory.value && composer.draft.value.trim().length === 0) {
      restoreCategoryToDraft()
      return
    }

    closeWindow()
    return
  }

  if (
    event.key === 'Backspace' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    composer.selectedCategory.value &&
    composer.draft.value.length === 0
  ) {
    event.preventDefault()
    restoreCategoryToDraft()
    return
  }

  if (
    event.key === ' ' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !composer.selectedCategory.value &&
    composer.categoryQuery.value.length > 0
  ) {
    event.preventDefault()
    const confirmed = composer.confirmCategoryPrefix()
    if (confirmed) {
      requestAnimationFrame(focusInput)
      void syncWindowHeight()
    }
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void handleSubmit()
  }
}

let stopFocusQuickAddInputListener: (() => void) | null = null
let stopQuickAddSessionRequestedListener: (() => void) | null = null

watch(
  [() => composer.draft.value, () => composer.selectedCategory.value?.name ?? '', statusText],
  () => {
    void syncWindowHeight()
  },
  { immediate: true, flush: 'post' }
)

onMounted(() => {
  void composer.loadCategories()
  requestAnimationFrame(focusInput)

  if (window.api?.window?.onFocusQuickAddInputRequested) {
    stopFocusQuickAddInputListener = window.api.window.onFocusQuickAddInputRequested(() => {
      requestAnimationFrame(focusInput)
    })
  }

  if (window.api?.window?.onQuickAddSessionRequested) {
    stopQuickAddSessionRequestedListener = window.api.window.onQuickAddSessionRequested(() => {
      handleQuickAddSessionRequested()
    })
  }
})

onUnmounted(() => {
  stopFocusQuickAddInputListener?.()
  stopQuickAddSessionRequestedListener?.()
})
</script>

<template>
  <section ref="rootRef" class="quick-add-window">
    <header class="quick-add-window__bar">
      <span class="quick-add-window__badge">Quick Add</span>

      <button
        class="quick-add-window__close"
        type="button"
        aria-label="关闭快捷新增"
        @click="closeWindow"
      >
        <X :size="14" />
      </button>
    </header>

    <div
      class="quick-add-window__composer"
      :class="{ 'quick-add-window__composer--error': hasError }"
    >
      <button
        v-if="composer.selectedCategory.value"
        class="quick-add-window__chip"
        type="button"
        @click="restoreCategoryToDraft"
      >
        #{{ composer.selectedCategory.value.name }}
        <X :size="12" />
      </button>

      <textarea
        ref="inputRef"
        v-model="composer.draft.value"
        class="quick-add-window__input"
        rows="1"
        maxlength="100"
        :placeholder="placeholderText"
        :disabled="composer.isSubmitting.value"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <p
        v-if="statusText"
        class="quick-add-window__status"
        :class="{ 'quick-add-window__status--error': hasError }"
      >
        {{ statusText }}
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use './styles/variables' as *;

.quick-add-window {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 0 12px 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%);
  color: $text-primary;
  box-sizing: border-box;
  overflow: hidden;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 0 -12px;
    padding: 12px 14px 10px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    background: linear-gradient(180deg, rgba(#ffffff, 0.94) 0%, rgba(#f6f9fd, 0.88) 100%);
    -webkit-app-region: drag;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    background: rgba($accent-color, 0.08);
    color: $accent-color;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__close {
    -webkit-app-region: no-drag;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 9px;
    background: rgba(#ffffff, 0.72);
    color: $text-secondary;
    cursor: pointer;
    transition:
      border-color $transition-fast,
      background-color $transition-fast,
      color $transition-fast;

    &:hover {
      border-color: rgba(15, 23, 42, 0.12);
      background: rgba(15, 23, 42, 0.04);
      color: $text-primary;
    }
  }

  &__composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 14px;
    background: rgba(#ffffff, 0.94);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
    transition:
      border-color $transition-fast,
      box-shadow $transition-fast,
      background-color $transition-fast;
    -webkit-app-region: no-drag;

    &:focus-within {
      border-color: rgba($accent-color, 0.5);
      box-shadow:
        0 0 0 3px rgba($accent-color, 0.08),
        0 10px 26px rgba(15, 23, 42, 0.06);
      background: #fff;
    }

    &--error {
      border-color: rgba($danger-color, 0.35);
    }
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    min-height: 26px;
    padding: 0 10px;
    border: 1px solid rgba($accent-color, 0.15);
    border-radius: 999px;
    background: rgba($accent-color, 0.08);
    color: $accent-color;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  &__input {
    width: 100%;
    min-height: 24px;
    border: none;
    background: transparent;
    color: $text-primary;
    font: inherit;
    font-size: 14px;
    line-height: 24px;
    resize: none;
    overflow: hidden;
    outline: none;

    &::placeholder {
      color: $text-muted;
    }

    &:disabled {
      opacity: 0.56;
      cursor: not-allowed;
    }
  }

  &__status {
    font-size: 12px;
    line-height: 1.45;
    color: $text-secondary;

    &--error {
      color: $danger-color;
    }
  }
}
</style>
