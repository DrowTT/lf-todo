import { reactive } from 'vue'
import { db, Category } from '../db'

// ─── localStorage 持久化封装（优化 #7）──────────────────────────
const STORAGE_KEY = 'currentCategoryId'

const persistence = {
  get(): number | null {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? parseInt(v) : null
  },
  set(id: number) {
    localStorage.setItem(STORAGE_KEY, String(id))
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}
// ────────────────────────────────────────────────────────────────

export const categoryStore = reactive({
  categories: [] as Category[],
  currentCategoryId: null as number | null,

  /**
   * 仅刷新分类列表，不触碰 currentCategoryId（优化 #4）
   * addCategory / deleteCategory / updateCategory 均调此方法
   */
  async _loadList() {
    this.categories = await db.getCategories()
  },

  /**
   * 加载列表并恢复历史选中分类（优化 #4，职责分离）
   * 应用初始化时调用一次，返回 true 表示已有有效选中分类
   */
  async fetchCategories() {
    await this._loadList()

    const savedId = persistence.get()
    if (savedId) {
      if (this.categories.find((c) => c.id === savedId)) {
        this.currentCategoryId = savedId
        return true // 已恢复历史选中，调用方负责 fetchTasks
      }
    }

    if (!this.currentCategoryId && this.categories.length > 0) {
      this.currentCategoryId = this.categories[0].id
      return true
    }

    return false
  },

  async addCategory(name: string) {
    await db.createCategory(name)
    // 只刷新列表（优化 #4），之后手动更新选中 — 不调 fetchCategories 避免重置 currentCategoryId
    await this._loadList()
    if (this.categories.length > 0) {
      this.currentCategoryId = this.categories[this.categories.length - 1].id
      persistence.set(this.currentCategoryId)
    }
  },

  async deleteCategory(id: number) {
    await db.deleteCategory(id)
    await this._loadList()
    if (this.currentCategoryId === id) {
      if (this.categories.length > 0) {
        this.currentCategoryId = this.categories[0].id
        persistence.set(this.currentCategoryId)
      } else {
        this.currentCategoryId = null
        persistence.clear()
      }
    }
  },

  async updateCategory(id: number, name: string) {
    await db.updateCategory(id, name)
    // 只刷新列表，不重置选中状态（优化 #4）
    await this._loadList()
  },

  selectCategory(id: number) {
    this.currentCategoryId = id
    persistence.set(id)
  }
})
