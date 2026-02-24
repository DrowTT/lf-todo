import { reactive } from 'vue'
import { db, Category, Task } from '../db'

const STORAGE_KEY = 'currentCategoryId'

export const store = reactive({
  categories: [] as Category[],
  currentCategoryId: null as number | null,
  tasks: [] as Task[],
  pendingCounts: {} as Record<number, number>,

  async fetchCategories() {
    this.categories = await db.getCategories()
    await this.fetchPendingCounts()

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

  // 获取各分类的待完成任务数
  async fetchPendingCounts() {
    this.pendingCounts = await db.getPendingTaskCounts()
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
    // 选中新建的分类（最后一个）
    if (this.categories.length > 0) {
      this.currentCategoryId = this.categories[this.categories.length - 1].id
      localStorage.setItem(STORAGE_KEY, this.currentCategoryId.toString())
      await this.fetchTasks()
    }
  },

  async deleteCategory(id: number) {
    await db.deleteCategory(id)
    await this.fetchCategories()
    // 如果删除了当前分类，选择第一个可用分类
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
    // 切换分类时清空子任务缓存和展开状态
    this.subTasksMap = {}
    this.expandedTaskIds = new Set()
    await this.fetchTasks()
  },

  async addTask(content: string) {
    if (!this.currentCategoryId) return
    await db.createTask(content, this.currentCategoryId)
    await this.fetchTasks()
    await this.fetchPendingCounts()
  },

  async toggleTask(id: number) {
    await db.toggleTaskComplete(id)
    await this.fetchTasks()
    await this.fetchPendingCounts()
  },

  async deleteTask(id: number) {
    // 删除父任务时清理子任务缓存和展开状态
    delete this.subTasksMap[id]
    this.expandedTaskIds.delete(id)
    await db.deleteTask(id)
    await this.fetchTasks()
    await this.fetchPendingCounts()
  },

  // 更新待办内容
  async updateTaskContent(id: number, content: string) {
    await db.updateTask(id, { content })
    await this.fetchTasks()
  },

  async clearCompletedTasks() {
    // 只清除顶级已完成任务（store.tasks 已经只含顶级任务）
    const completedTaskIds = this.tasks.filter((t) => t.is_completed).map((t) => t.id)
    if (completedTaskIds.length === 0) return

    // 清理已完成父任务的子任务缓存
    completedTaskIds.forEach((id) => {
      delete this.subTasksMap[id]
      this.expandedTaskIds.delete(id)
    })

    await db.deleteTasks(completedTaskIds)
    await this.fetchTasks()
    await this.fetchPendingCounts()
  },

  // ==================== 子任务相关 ====================

  // parentId -> 子任务列表的映射缓存
  subTasksMap: {} as Record<number, Task[]>,
  // 已展开的父任务 ID 集合（每次赋值新 Set 以触发响应式更新）
  expandedTaskIds: new Set<number>(),

  // 加载指定父任务的子任务列表
  async fetchSubTasks(parentId: number) {
    this.subTasksMap[parentId] = await db.getSubTasks(parentId)
  },

  // 展开/收起子任务（首次展开时懒加载）
  async toggleExpand(taskId: number) {
    if (this.expandedTaskIds.has(taskId)) {
      const next = new Set(this.expandedTaskIds)
      next.delete(taskId)
      this.expandedTaskIds = next
    } else {
      // 首次展开时加载数据
      if (!this.subTasksMap[taskId]) {
        await this.fetchSubTasks(taskId)
      }
      this.expandedTaskIds = new Set(this.expandedTaskIds).add(taskId)
    }
  },

  // 新增子任务
  async addSubTask(content: string, parentId: number) {
    await db.createSubTask(content, parentId)
    await this.fetchSubTasks(parentId)
  },

  // 切换子任务完成状态
  async toggleSubTask(id: number, parentId: number) {
    await db.toggleTaskComplete(id)
    await this.fetchSubTasks(parentId)
  },

  // 删除子任务
  async deleteSubTask(id: number, parentId: number) {
    await db.deleteTask(id)
    await this.fetchSubTasks(parentId)
  },

  // 更新子任务内容
  async updateSubTaskContent(id: number, parentId: number, content: string) {
    await db.updateTask(id, { content })
    await this.fetchSubTasks(parentId)
  }
})
