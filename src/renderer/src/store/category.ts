import { reactive } from 'vue'
import { db, Category } from '../db'

const STORAGE_KEY = 'currentCategoryId'

export const categoryStore = reactive({
  categories: [] as Category[],
  currentCategoryId: null as number | null,

  async fetchCategories() {
    this.categories = await db.getCategories()

    const savedCategoryId = localStorage.getItem(STORAGE_KEY)
    if (savedCategoryId) {
      const categoryId = parseInt(savedCategoryId)
      if (this.categories.find((c) => c.id === categoryId)) {
        this.currentCategoryId = categoryId
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
    await this.fetchCategories()
    if (this.categories.length > 0) {
      this.currentCategoryId = this.categories[this.categories.length - 1].id
      localStorage.setItem(STORAGE_KEY, this.currentCategoryId.toString())
    }
  },

  async deleteCategory(id: number) {
    await db.deleteCategory(id)
    await this.fetchCategories()
    if (this.currentCategoryId === id) {
      if (this.categories.length > 0) {
        this.currentCategoryId = this.categories[0].id
        localStorage.setItem(STORAGE_KEY, this.currentCategoryId.toString())
      } else {
        this.currentCategoryId = null
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  },

  async updateCategory(id: number, name: string) {
    await db.updateCategory(id, name)
    await this.fetchCategories()
  },

  selectCategory(id: number) {
    this.currentCategoryId = id
    localStorage.setItem(STORAGE_KEY, id.toString())
  }
})
