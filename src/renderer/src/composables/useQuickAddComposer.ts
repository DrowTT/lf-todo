import { computed, ref, shallowRef } from 'vue'
import type { Category, QuickAddSubmitResult } from '../../../shared/types/models'
import { writeStoredNumber } from '../utils/localStorage'
import { normalizeCategoryName, parseLeadingCategoryDraft } from '../utils/quickAdd'
import { getCategoryDisplayName } from '../utils/taskNavigation'

const QUICK_ADD_CATEGORY_STORAGE_KEY = 'lf-todo:quick-add-category-id'

interface SelectedCategoryState {
  id: number | null
  name: string
  isNew: boolean
}

interface CategoryResolution {
  kind: 'empty' | 'existing' | 'create' | 'ambiguous'
  category?: Category
  name?: string
  matches: Category[]
}

function getCategoryLabel(category: Pick<Category, 'name' | 'is_system'>): string {
  return getCategoryDisplayName(category) || category.name
}

function getCategoryLookupNames(category: Category): string[] {
  const lookupNames = [category.name, getCategoryLabel(category)]

  return [...new Set(lookupNames.map((name) => normalizeCategoryName(name)).filter(Boolean))]
}

function getBestLookupName(category: Category, normalizedQuery: string): string {
  return (
    getCategoryLookupNames(category)
      .filter((lookupName) => lookupName.includes(normalizedQuery))
      .sort((left, right) => {
        const leftStartsWith = left.startsWith(normalizedQuery)
        const rightStartsWith = right.startsWith(normalizedQuery)

        if (leftStartsWith !== rightStartsWith) {
          return leftStartsWith ? -1 : 1
        }

        if (left.length !== right.length) {
          return left.length - right.length
        }

        return left.localeCompare(right)
      })[0] ?? ''
  )
}

function rankCategories(categories: Category[], query: string): Category[] {
  const normalizedQuery = normalizeCategoryName(query)

  return categories
    .filter((category) =>
      getCategoryLookupNames(category).some((lookupName) => lookupName.includes(normalizedQuery))
    )
    .sort((left, right) => {
      const leftName = getBestLookupName(left, normalizedQuery)
      const rightName = getBestLookupName(right, normalizedQuery)
      const leftStartsWith = leftName.startsWith(normalizedQuery)
      const rightStartsWith = rightName.startsWith(normalizedQuery)

      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1
      }

      if (leftName.length !== rightName.length) {
        return leftName.length - rightName.length
      }

      return leftName.localeCompare(rightName)
    })
}

export function useQuickAddComposer() {
  const draft = shallowRef('')
  const categories = ref<Category[]>([])
  const selectedCategory = ref<SelectedCategoryState | null>(null)
  const isLoading = shallowRef(false)
  const isSubmitting = shallowRef(false)
  const errorMessage = shallowRef('')

  const leadingCategoryDraft = computed(() =>
    selectedCategory.value ? null : parseLeadingCategoryDraft(draft.value)
  )
  const categoryQuery = computed(() => leadingCategoryDraft.value?.query ?? '')
  const taskContent = computed(() => draft.value.trim())
  const defaultCategory = computed(() => categories.value.find((category) => category.is_system) ?? null)
  const defaultCategoryLabel = computed(() =>
    defaultCategory.value ? getCategoryLabel(defaultCategory.value) : ''
  )

  const resolution = computed<CategoryResolution>(() => {
    const query = categoryQuery.value.trim()
    if (!query) {
      return { kind: 'empty', matches: [] }
    }

    const normalizedQuery = normalizeCategoryName(query)
    const exactCategory = categories.value.find((category) =>
      getCategoryLookupNames(category).some((lookupName) => lookupName === normalizedQuery)
    )

    if (exactCategory) {
      return {
        kind: 'existing',
        category: exactCategory,
        matches: [exactCategory]
      }
    }

    const matches = rankCategories(categories.value, query)

    if (matches.length === 0) {
      return {
        kind: 'create',
        name: query,
        matches: []
      }
    }

    if (matches.length === 1) {
      return {
        kind: 'existing',
        category: matches[0],
        matches
      }
    }

    return {
      kind: 'ambiguous',
      name: query,
      matches
    }
  })

  const previewMatches = computed(() => resolution.value.matches.slice(0, 3))
  const canConfirmCategory = computed(
    () => resolution.value.kind === 'existing' || resolution.value.kind === 'create'
  )

  async function loadCategories(): Promise<void> {
    if (!window.api?.db) {
      errorMessage.value = '当前环境不支持快捷新增。'
      return
    }

    isLoading.value = true
    errorMessage.value = ''

    try {
      categories.value = await window.api.db.getCategories()
    } catch (error) {
      console.error('[quick-add] load categories failed', error)
      errorMessage.value = '分类加载失败，请稍后重试。'
    } finally {
      isLoading.value = false
    }
  }

  function clearSelectedCategory(): void {
    if (!selectedCategory.value) {
      errorMessage.value = ''
      return
    }

    const restoredDraft =
      draft.value.length > 0
        ? `#${selectedCategory.value.name} ${draft.value}`
        : `#${selectedCategory.value.name} `

    selectedCategory.value = null
    draft.value = restoredDraft
    errorMessage.value = ''
  }

  function clearDraft(): void {
    draft.value = ''
    selectedCategory.value = null
    errorMessage.value = ''
  }

  async function prepareForSession(): Promise<void> {
    clearDraft()
    await loadCategories()
  }

  function confirmCategoryPrefix(): boolean {
    const parsedDraft = parseLeadingCategoryDraft(draft.value)
    const query = parsedDraft?.query ?? ''

    if (!query) {
      errorMessage.value = '先输入 #分类名，再按空格确认分类。'
      return false
    }

    if (resolution.value.kind === 'ambiguous') {
      const matchNames = resolution.value.matches
        .slice(0, 3)
        .map((category) => getCategoryLabel(category))
        .join('、')
      errorMessage.value = `匹配到多个分类：${matchNames}，请继续输入更完整的分类名。`
      return false
    }

    if (resolution.value.kind === 'empty') {
      errorMessage.value = '先输入 #分类名，再按空格确认分类。'
      return false
    }

    if (resolution.value.kind === 'existing' && resolution.value.category) {
      selectedCategory.value = {
        id: resolution.value.category.id,
        name: getCategoryLabel(resolution.value.category),
        isNew: false
      }
      draft.value = parsedDraft?.remainder ?? ''
      errorMessage.value = ''
      return true
    }

    if (resolution.value.kind === 'create' && resolution.value.name) {
      selectedCategory.value = {
        id: null,
        name: resolution.value.name,
        isNew: true
      }
      draft.value = parsedDraft?.remainder ?? ''
      errorMessage.value = ''
      return true
    }

    return false
  }

  async function submit(): Promise<QuickAddSubmitResult | null> {
    if (!selectedCategory.value && leadingCategoryDraft.value?.hasSeparator) {
      const confirmed = confirmCategoryPrefix()
      if (!confirmed) {
        return null
      }
    }

    const content = taskContent.value
    if (!content) {
      errorMessage.value = '先写待办内容。'
      return null
    }

    const resolvedCategory =
      selectedCategory.value ??
      (categoryQuery.value.length === 0 && defaultCategory.value
        ? {
            id: defaultCategory.value.id,
            name: defaultCategoryLabel.value,
            isNew: false
          }
        : null)

    if (!resolvedCategory) {
      errorMessage.value = '先输入 #分类名，并按空格确认分类。'
      return null
    }

    if (!window.api?.quickAdd) {
      errorMessage.value = '当前环境不支持快捷新增。'
      return null
    }

    isSubmitting.value = true
    errorMessage.value = ''

    try {
      const result = await window.api.quickAdd.submit({
        content,
        categoryId: resolvedCategory.id,
        categoryName: resolvedCategory.id ? null : resolvedCategory.name
      })

      selectedCategory.value = {
        id: result.category.id,
        name: getCategoryLabel(result.category),
        isNew: false
      }
      writeStoredNumber(QUICK_ADD_CATEGORY_STORAGE_KEY, result.category.id)
      draft.value = ''
      return result
    } catch (error) {
      console.error('[quick-add] submit failed', error)
      errorMessage.value = '新增失败，请重试。'
      return null
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    draft,
    categories,
    selectedCategory,
    isLoading,
    isSubmitting,
    errorMessage,
    categoryQuery,
    previewMatches,
    resolution,
    canConfirmCategory,
    defaultCategory,
    defaultCategoryLabel,
    taskContent,
    loadCategories,
    clearSelectedCategory,
    clearDraft,
    prepareForSession,
    confirmCategoryPrefix,
    submit
  }
}
