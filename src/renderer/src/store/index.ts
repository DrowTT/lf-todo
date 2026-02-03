import { reactive } from 'vue'
import { db, Category, Task } from '../db'

const STORAGE_KEY = 'currentCategoryId'

export const store = reactive({
  categories: [] as Category[],
  currentCategoryId: null as number | null,
  tasks: [] as Task[],

  async fetchCategories() {
    this.categories = await db.getCategories()

    // 优先恢复上次选中的分类
    const savedCategoryId = localStorage.getItem(STORAGE_KEY)
    if (savedCategoryId) {
      const categoryId = parseInt(savedCategoryId)
      // 检查该分类是否仍然存在
      if (this.categories.find((c) => c.id === categoryId)) {
        this.currentCategoryId = categoryId
        await this.fetchTasks()
        return
      }
    }

    // 如果没有保存的分类或分类已被删除,选择第一个
    if (!this.currentCategoryId && this.categories.length > 0) {
      this.currentCategoryId = this.categories[0].id
      await this.fetchTasks()
    }
  },

  async fetchTasks() {
    if (this.currentCategoryId) {
      this.tasks = await db.getTasks(this.currentCategoryId)
    } else {
      this.tasks = []
    }
  },

  async addCategory(name: string) {
    await db.createCategory(name)
    await this.fetchCategories()
    // Select the new category (last one)
    if (this.categories.length > 0) {
      this.currentCategoryId = this.categories[this.categories.length - 1].id
      localStorage.setItem(STORAGE_KEY, this.currentCategoryId.toString())
      await this.fetchTasks()
    }
  },

  async deleteCategory(id: number) {
    await db.deleteCategory(id)
    await this.fetchCategories()
    // If deleted current, select first available
    if (this.currentCategoryId === id) {
      if (this.categories.length > 0) {
        this.currentCategoryId = this.categories[0].id
        localStorage.setItem(STORAGE_KEY, this.currentCategoryId.toString())
      } else {
        this.currentCategoryId = null
        localStorage.removeItem(STORAGE_KEY)
      }
      await this.fetchTasks()
    }
  },

  async updateCategory(id: number, name: string) {
    await db.updateCategory(id, name)
    await this.fetchCategories()
  },

  async selectCategory(id: number) {
    this.currentCategoryId = id
    localStorage.setItem(STORAGE_KEY, id.toString())
    await this.fetchTasks()
  },

  async addTask(content: string) {
    if (!this.currentCategoryId) return
    await db.createTask(content, this.currentCategoryId)
    await this.fetchTasks()
  },

  async toggleTask(id: number) {
    await db.toggleTaskComplete(id)
    await this.fetchTasks()
  },

  async deleteTask(id: number) {
    await db.deleteTask(id)
    await this.fetchTasks()
  },

  async clearCompletedTasks() {
    const completedTasks = this.tasks.filter((t) => t.is_completed)
    for (const task of completedTasks) {
      await db.deleteTask(task.id)
    }
    await this.fetchTasks()
  }
})
