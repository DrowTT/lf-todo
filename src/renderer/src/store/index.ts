import { reactive } from 'vue'
import { db, Category, Task } from '../db'

const STORAGE_KEY = 'currentCategoryId'

// ─── 展开状态持久化辅助 ─────────────────────────────────────
const expandedKey = (categoryId: number) => `lf-todo-expanded-${categoryId}`

function loadExpandedIds(categoryId: number): Set<number> {
  try {
    const raw = localStorage.getItem(expandedKey(categoryId))
    if (raw) return new Set(JSON.parse(raw) as number[])
  } catch {}
  return new Set()
}

function saveExpandedIds(categoryId: number, ids: Set<number>) {
  localStorage.setItem(expandedKey(categoryId), JSON.stringify([...ids]))
}
// ─────────────────────────────────────────────────────────────

export const store = reactive({
  categories: [] as Category[],
  currentCategoryId: null as number | null,
  tasks: [] as Task[],
  isLoading: false,

  // ─── P2：pendingCounts 改为本地 getter，彻底消除冗余 IPC ───
  get pendingCounts(): Record<number, number> {
    return this._pendingCountsCache
  },

  // 缓存各分类的 pending 数（初始从 IPC 拉取，后续本地维护）
  _pendingCountsCache: {} as Record<number, number>,

  // ─── 本地辅助：根据当前分类 ID 和 delta 更新徽标缓存 ───────
  _adjustPendingCount(categoryId: number, delta: number) {
    const cur = this._pendingCountsCache[categoryId] ?? 0
    this._pendingCountsCache[categoryId] = Math.max(0, cur + delta)
  },

  async fetchCategories() {
    this.categories = await db.getCategories()
    // 仅在初始化时从 IPC 拉取一次 pendingCounts
    this._pendingCountsCache = await db.getPendingTaskCounts()

    const savedCategoryId = localStorage.getItem(STORAGE_KEY)
    if (savedCategoryId) {
      const categoryId = parseInt(savedCategoryId)
      if (this.categories.find((c) => c.id === categoryId)) {
        this.currentCategoryId = categoryId
        await this.fetchTasks()
        return
      }
    }

    if (!this.currentCategoryId && this.categories.length > 0) {
      this.currentCategoryId = this.categories[0].id
      await this.fetchTasks()
    }
  },

  async fetchTasks() {
    if (this.currentCategoryId) {
      this.isLoading = true
      try {
        this.tasks = await db.getTasks(this.currentCategoryId)
        this.expandedTaskIds = loadExpandedIds(this.currentCategoryId)
        for (const taskId of this.expandedTaskIds) {
          if (!this.subTasksMap[taskId]) {
            this.fetchSubTasks(taskId)
          }
        }
        // 同步校正当前分类的 pending 数（fetchTasks 后以实际数据为准）
        const pending = this.tasks.filter((t) => !t.is_completed && t.parent_id === null).length
        this._pendingCountsCache[this.currentCategoryId] = pending
      } finally {
        this.isLoading = false
      }
    } else {
      this.tasks = []
    }
  },

  async addCategory(name: string) {
    await db.createCategory(name)
    await this.fetchCategories()
    if (this.categories.length > 0) {
      this.currentCategoryId = this.categories[this.categories.length - 1].id
      localStorage.setItem(STORAGE_KEY, this.currentCategoryId.toString())
      await this.fetchTasks()
    }
  },

  async deleteCategory(id: number) {
    await db.deleteCategory(id)
    delete this._pendingCountsCache[id]
    await this.fetchCategories()
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
    this.subTasksMap = {}
    this.expandedTaskIds = new Set()
    await this.fetchTasks()
  },

  // ─── P1：addTask 本地立即插入，无需全量重拉 ─────────────────
  async addTask(content: string) {
    if (!this.currentCategoryId) return
    // IPC 返回完整 Task 对象（数据库已支持）
    const newTask = await db.createTask(content, this.currentCategoryId)
    // 本地乐观插入（ORDER BY order_index DESC, id DESC，新任务排在最前）
    this.tasks.unshift({
      ...newTask,
      subtask_total: 0,
      subtask_done: 0
    })
    // 本地更新分类徽标
    this._adjustPendingCount(this.currentCategoryId, 1)
  },

  // ─── P1：toggleTask 本地立即切换，后台持久化 ────────────────
  async toggleTask(id: number) {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return
    // 计算新状态
    const newCompleted = task.is_completed ? 0 : 1
    // 本地立即更新
    task.is_completed = newCompleted
    // 本地更新 pendingCounts
    if (this.currentCategoryId) {
      this._adjustPendingCount(this.currentCategoryId, newCompleted ? -1 : 1)
    }
    // 后台持久化（fire-and-forget，不阻塞 UI）
    db.toggleTaskComplete(id)
  },

  // ─── P1：deleteTask 本地立即移除，后台持久化 ─────────────────
  async deleteTask(id: number) {
    const idx = this.tasks.findIndex((t) => t.id === id)
    if (idx === -1) return
    const task = this.tasks[idx]
    // 更新 pendingCounts（只统计未完成任务）
    if (!task.is_completed && this.currentCategoryId) {
      this._adjustPendingCount(this.currentCategoryId, -1)
    }
    // 本地立即移除
    this.tasks.splice(idx, 1)
    delete this.subTasksMap[id]
    this.expandedTaskIds.delete(id)
    this._persistExpanded()
    // 后台持久化
    db.deleteTask(id)
  },

  // ─── P1：updateTaskContent 本地立即更新，后台持久化 ──────────
  async updateTaskContent(id: number, content: string) {
    const task = this.tasks.find((t) => t.id === id)
    if (task) task.content = content
    db.updateTask(id, { content })
  },

  async clearCompletedTasks() {
    const completedTaskIds = this.tasks.filter((t) => t.is_completed).map((t) => t.id)
    if (completedTaskIds.length === 0) return

    // 本地立即移除已完成任务
    const completedSet = new Set(completedTaskIds)
    this.tasks = this.tasks.filter((t) => !completedSet.has(t.id))
    completedTaskIds.forEach((id) => {
      delete this.subTasksMap[id]
      this.expandedTaskIds.delete(id)
    })
    this._persistExpanded()
    // pendingCounts 不受影响（只计未完成）
    // 后台持久化
    db.deleteTasks(completedTaskIds)
  },

  // ==================== 子任务相关 ====================

  subTasksMap: {} as Record<number, Task[]>,
  expandedTaskIds: new Set<number>(),

  _persistExpanded() {
    if (this.currentCategoryId) {
      saveExpandedIds(this.currentCategoryId, this.expandedTaskIds)
    }
  },

  async fetchSubTasks(parentId: number) {
    this.subTasksMap[parentId] = await db.getSubTasks(parentId)
  },

  async toggleExpand(taskId: number) {
    if (this.expandedTaskIds.has(taskId)) {
      const next = new Set(this.expandedTaskIds)
      next.delete(taskId)
      this.expandedTaskIds = next
    } else {
      if (!this.subTasksMap[taskId]) {
        await this.fetchSubTasks(taskId)
      }
      this.expandedTaskIds = new Set(this.expandedTaskIds).add(taskId)
    }
    this._persistExpanded()
  },

  // ─── P1：addSubTask 本地局部更新 ─────────────────────────────
  async addSubTask(content: string, parentId: number) {
    const newSubTask = await db.createSubTask(content, parentId)
    // 本地更新 subTasksMap
    if (!this.subTasksMap[parentId]) {
      this.subTasksMap[parentId] = []
    }
    this.subTasksMap[parentId] = [...this.subTasksMap[parentId], newSubTask]
    // 本地更新父任务的统计字段
    const parent = this.tasks.find((t) => t.id === parentId)
    if (parent) {
      parent.subtask_total = (parent.subtask_total ?? 0) + 1
    }
  },

  // ─── P1：toggleSubTask 本地局部更新 ──────────────────────────
  async toggleSubTask(id: number, parentId: number) {
    const list = this.subTasksMap[parentId]
    const sub = list?.find((t) => t.id === id)
    if (!sub) return
    const newCompleted = sub.is_completed ? 0 : 1
    sub.is_completed = newCompleted
    // 更新父任务 subtask_done
    const parent = this.tasks.find((t) => t.id === parentId)
    if (parent) {
      parent.subtask_done = (parent.subtask_done ?? 0) + (newCompleted ? 1 : -1)
    }
    // 后台持久化
    db.toggleTaskComplete(id)
  },

  // ─── P1：deleteSubTask 本地局部更新 ──────────────────────────
  async deleteSubTask(id: number, parentId: number) {
    const list = this.subTasksMap[parentId]
    if (!list) return
    const sub = list.find((t) => t.id === id)
    this.subTasksMap[parentId] = list.filter((t) => t.id !== id)
    // 更新父任务统计字段
    const parent = this.tasks.find((t) => t.id === parentId)
    if (parent) {
      parent.subtask_total = Math.max(0, (parent.subtask_total ?? 0) - 1)
      if (sub?.is_completed) {
        parent.subtask_done = Math.max(0, (parent.subtask_done ?? 0) - 1)
      }
    }
    // 后台持久化
    db.deleteTask(id)
  },

  async updateSubTaskContent(id: number, parentId: number, content: string) {
    const list = this.subTasksMap[parentId]
    const sub = list?.find((t) => t.id === id)
    if (sub) sub.content = content
    db.updateTask(id, { content })
  }
})
