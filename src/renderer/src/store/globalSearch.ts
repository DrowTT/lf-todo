import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Task } from '../../../shared/types/models'
import type { SearchTasksInput } from '../services/repositories/taskRepository'
import { useAppRuntime } from '../app/runtime'
import { useCategoryStore } from './category'

export type GlobalSearchScope = 'all' | 'current'

const SEARCH_RESULT_LIMIT = 24
const TASK_HIGHLIGHT_DURATION_MS = 1800

interface ScopeContext {
  currentCategoryId: number | null
  isSystemCategory?: boolean
}

export const useGlobalSearchStore = defineStore('globalSearch', () => {
  const { repositories, toast } = useAppRuntime()
  const categoryStore = useCategoryStore()

  const isOpen = ref(false)
  const query = ref('')
  const scope = ref<GlobalSearchScope>('all')
  const results = ref<Task[]>([])
  const isLoading = ref(false)
  const selectedIndex = ref(0)
  const pendingRevealTaskId = ref<number | null>(null)
  const activeHighlightTaskId = ref<number | null>(null)

  const selectedTask = computed(() => results.value[selectedIndex.value] ?? null)

  let latestSearchRequestId = 0
  let highlightTimer: ReturnType<typeof setTimeout> | null = null

  function normalizeScope(
    nextScope: GlobalSearchScope,
    currentCategoryId: number | null,
    isSystemCategory = false
  ): GlobalSearchScope {
    if (nextScope === 'current' && currentCategoryId && !isSystemCategory) {
      return 'current'
    }

    return 'all'
  }

  function open(
    nextScopeOrOptions: GlobalSearchScope | ({ scope?: GlobalSearchScope } & Partial<ScopeContext>),
    options?: ScopeContext & {
      preserveQuery?: boolean
    }
  ) {
    const resolvedOpenOptions = resolveOpenOptions(nextScopeOrOptions, options)
    const resolvedScope = normalizeScope(
      resolvedOpenOptions.scope,
      resolvedOpenOptions.currentCategoryId,
      resolvedOpenOptions.isSystemCategory
    )

    if (!isOpen.value || !resolvedOpenOptions.preserveQuery) {
      query.value = ''
      results.value = []
      selectedIndex.value = 0
    }

    scope.value = resolvedScope
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    isLoading.value = false
    selectedIndex.value = 0
  }

  function setQuery(value: string) {
    query.value = value
    selectedIndex.value = 0
  }

  function setScope(
    nextScope: GlobalSearchScope,
    options: {
      currentCategoryId: number | null
      isSystemCategory?: boolean
    }
  ) {
    scope.value = normalizeScope(nextScope, options.currentCategoryId, options.isSystemCategory)
    selectedIndex.value = 0
  }

  async function search(input: SearchTasksInput) {
    const trimmedQuery = input.query.trim()
    const requestId = ++latestSearchRequestId

    if (!trimmedQuery) {
      results.value = []
      isLoading.value = false
      selectedIndex.value = 0
      return []
    }

    if (!repositories.task.searchTasks) {
      results.value = []
      isLoading.value = false
      return []
    }

    isLoading.value = true

    try {
      const nextResults = await repositories.task.searchTasks({
        query: trimmedQuery,
        categoryId: input.categoryId ?? null,
        limit: input.limit ?? SEARCH_RESULT_LIMIT
      })

      if (requestId !== latestSearchRequestId) {
        return []
      }

      results.value = nextResults
      selectedIndex.value =
        nextResults.length === 0 ? 0 : Math.min(selectedIndex.value, nextResults.length - 1)

      return nextResults
    } catch (error) {
      if (requestId === latestSearchRequestId) {
        results.value = []
        selectedIndex.value = 0
        toast.show('搜索任务失败，请稍后重试')
      }
      console.error('[globalSearchStore] search failed', error)
      return []
    } finally {
      if (requestId === latestSearchRequestId) {
        isLoading.value = false
      }
    }
  }

  function moveSelection(step: number) {
    if (results.value.length === 0) return

    const lastIndex = results.value.length - 1
    const nextIndex = selectedIndex.value + step
    selectedIndex.value = Math.min(Math.max(nextIndex, 0), lastIndex)
  }

  function moveSelectionToEdge(edge: 'start' | 'end') {
    if (results.value.length === 0) return
    selectedIndex.value = edge === 'start' ? 0 : results.value.length - 1
  }

  function selectIndex(index: number) {
    if (index < 0 || index >= results.value.length) return
    selectedIndex.value = index
  }

  function markTaskForReveal(taskId: number) {
    pendingRevealTaskId.value = taskId
  }

  function clearPendingReveal(taskId?: number) {
    if (taskId !== undefined && pendingRevealTaskId.value !== taskId) {
      return
    }

    pendingRevealTaskId.value = null
  }

  function highlightTask(taskId: number) {
    activeHighlightTaskId.value = taskId

    if (highlightTimer) {
      clearTimeout(highlightTimer)
    }

    highlightTimer = setTimeout(() => {
      if (activeHighlightTaskId.value === taskId) {
        activeHighlightTaskId.value = null
      }
      highlightTimer = null
    }, TASK_HIGHLIGHT_DURATION_MS)
  }

  return {
    isOpen,
    query,
    scope,
    results,
    isLoading,
    selectedIndex,
    selectedTask,
    pendingRevealTaskId,
    activeHighlightTaskId,
    open,
    close,
    setQuery,
    setScope,
    search,
    moveSelection,
    moveSelectionToEdge,
    selectIndex,
    markTaskForReveal,
    clearPendingReveal,
    highlightTask
  }

  function resolveOpenOptions(
    nextScopeOrOptions: GlobalSearchScope | ({ scope?: GlobalSearchScope } & Partial<ScopeContext>),
    options?: ScopeContext & {
      preserveQuery?: boolean
    }
  ) {
    if (typeof nextScopeOrOptions === 'string') {
      return {
        scope: nextScopeOrOptions,
        currentCategoryId: options?.currentCategoryId ?? categoryStore.currentCategoryId,
        isSystemCategory: options?.isSystemCategory ?? false,
        preserveQuery: options?.preserveQuery ?? false
      }
    }

    const currentCategory =
      categoryStore.categories.find((category) => category.id === categoryStore.currentCategoryId) ?? null

    return {
      scope: nextScopeOrOptions.scope ?? 'all',
      currentCategoryId: nextScopeOrOptions.currentCategoryId ?? categoryStore.currentCategoryId,
      isSystemCategory: nextScopeOrOptions.isSystemCategory ?? currentCategory?.is_system ?? false,
      preserveQuery: false
    }
  }
})
