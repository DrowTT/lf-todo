import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Category } from '../../../shared/types/models'
import { useAppRuntime } from '../app/runtime'
import { clearStoredValue, readStoredNumber, writeStoredNumber } from '../utils/localStorage'

// ─── localStorage 持久化封装 ──────────────────────────────────────
// 统一使用 lf-todo: 前缀（与 useSidebarResize.ts、subtask store 保持一致的命名规范）
export const CURRENT_CATEGORY_STORAGE_KEY = 'lf-todo:current-category-id'

const persistence = {
  get: () => readStoredNumber(CURRENT_CATEGORY_STORAGE_KEY),
  set: (id: number) => writeStoredNumber(CURRENT_CATEGORY_STORAGE_KEY, id),
  clear: () => clearStoredValue(CURRENT_CATEGORY_STORAGE_KEY)
}
// ─────────────────────────────────────────────────────────────────

/**
 * 分类 Store（Pinia setup store）
 *
 * 选用 setup store 而非 options store，原因：
 * 1. 与 Vue 3 Composition API 保持一致的编码风格
 * 2. 规避 options store 中 this 绑定在某些场景下的歧义
 * 3. ref / computed 天然没有解构丢失响应性的问题
 */
export const useCategoryStore = defineStore('category', () => {
  const categories = ref<Category[]>([])
  const currentCategoryId = ref<number | null>(null)

  const { repositories, toast } = useAppRuntime()
  const categoryRepository = repositories.category

  /**
   * 仅刷新分类列表，不触碰 currentCategoryId（优化 #4）
   * addCategory / deleteCategory / updateCategory 均调此方法
   */
  async function _loadList() {
    try {
      categories.value = await categoryRepository.getCategories()
    } catch (e) {
      console.error('[categoryStore] _loadList 失败:', e)
      throw e
    }
  }

  function selectFallbackCategory(): boolean {
    const firstCategoryId = categories.value[0]?.id ?? null
    currentCategoryId.value = firstCategoryId

    if (firstCategoryId === null) {
      persistence.clear()
      return false
    }

    persistence.set(firstCategoryId)
    return true
  }

  /**
   * 加载列表并恢复历史选中分类（应用初始化时调用一次）
   * 返回 true 表示已有有效选中分类
   */
  async function fetchCategories(): Promise<boolean> {
    try {
      await _loadList()

      const savedId = persistence.get()
      if (savedId) {
        if (categories.value.find((c) => c.id === savedId)) {
          currentCategoryId.value = savedId
          return true
        }
      }

      if (currentCategoryId.value) {
        const hasCurrentCategory = categories.value.some(
          (category) => category.id === currentCategoryId.value
        )
        if (hasCurrentCategory) {
          return true
        }
      }

      if (!currentCategoryId.value && categories.value.length > 0) {
        currentCategoryId.value = categories.value[0].id
        persistence.set(currentCategoryId.value)
        return true
      }

      return selectFallbackCategory()
    } catch (e) {
      console.error('[categoryStore] fetchCategories 失败:', e)
      toast.show('加载分类列表失败，请重试')
      throw e
    }
  }

  async function addCategory(name: string) {
    try {
      await categoryRepository.createCategory(name)
      await _loadList()
      if (categories.value.length > 0) {
        currentCategoryId.value = categories.value[categories.value.length - 1].id
        persistence.set(currentCategoryId.value)
      }
    } catch (e) {
      console.error('[categoryStore] addCategory 失败:', e)
      toast.show('创建分类失败，请重试')
      throw e
    }
  }

  async function deleteCategory(id: number) {
    try {
      await categoryRepository.deleteCategory(id)
      await _loadList()
      if (currentCategoryId.value === id) {
        selectFallbackCategory()
      }
    } catch (e) {
      console.error('[categoryStore] deleteCategory 失败:', e)
      toast.show('删除分类失败，请重试')
      throw e
    }
  }

  async function updateCategory(id: number, name: string) {
    try {
      await categoryRepository.updateCategory(id, name)
      await _loadList()
    } catch (e) {
      console.error('[categoryStore] updateCategory 失败:', e)
      toast.show('更新分类失败，请重试')
      throw e
    }
  }

  function selectCategory(id: number) {
    currentCategoryId.value = id
    persistence.set(id)
  }

  return {
    categories,
    currentCategoryId,
    fetchCategories,
    addCategory,
    deleteCategory,
    updateCategory,
    selectCategory
  }
})
