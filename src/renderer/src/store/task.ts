import { reactive } from 'vue'
import { db, Task } from '../db'

export const taskStore = reactive({
  tasks: [] as Task[],
  isLoading: false,

  // ─── pendingCounts 缓存（初始从 IPC 拉取，后续本地维护，消除冗余 IPC）
  _pendingCountsCache: {} as Record<number, number>,

  get pendingCounts(): Record<number, number> {
    return this._pendingCountsCache
  },

  _adjustPendingCount(categoryId: number, delta: number) {
    const cur = this._pendingCountsCache[categoryId] ?? 0
    this._pendingCountsCache[categoryId] = Math.max(0, cur + delta)
  },

  async initPendingCounts() {
    this._pendingCountsCache = await db.getPendingTaskCounts()
  },

  async fetchTasks(categoryId: number) {
    this.isLoading = true
    try {
      this.tasks = await db.getTasks(categoryId)
      // 以实际数据校正当前分类的 pending 数
      const pending = this.tasks.filter((t) => !t.is_completed && t.parent_id === null).length
      this._pendingCountsCache[categoryId] = pending
    } finally {
      this.isLoading = false
    }
  },

  clearTasks() {
    this.tasks = []
  },

  async addTask(content: string, categoryId: number) {
    const newTask = await db.createTask(content, categoryId)
    // 乐观插入（ORDER BY order_index DESC，新任务排最前）
    this.tasks.unshift({
      ...newTask,
      subtask_total: 0,
      subtask_done: 0
    })
    this._adjustPendingCount(categoryId, 1)
  },

  async toggleTask(id: number, categoryId: number) {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return
    const newCompleted = !task.is_completed
    task.is_completed = newCompleted
    this._adjustPendingCount(categoryId, newCompleted ? -1 : 1)
    // fire-and-forget，不阻塞 UI
    db.toggleTaskComplete(id)
  },

  async deleteTask(id: number, categoryId: number) {
    const idx = this.tasks.findIndex((t) => t.id === id)
    if (idx === -1) return
    const task = this.tasks[idx]
    if (!task.is_completed) {
      this._adjustPendingCount(categoryId, -1)
    }
    this.tasks.splice(idx, 1)
    db.deleteTask(id)
  },

  async updateTaskContent(id: number, content: string) {
    const task = this.tasks.find((t) => t.id === id)
    if (task) task.content = content
    db.updateTask(id, { content })
  },

  async clearCompletedTasks() {
    const completedIds = this.tasks.filter((t) => t.is_completed).map((t) => t.id)
    if (completedIds.length === 0) return
    const completedSet = new Set(completedIds)
    this.tasks = this.tasks.filter((t) => !completedSet.has(t.id))
    db.deleteTasks(completedIds)
    // pendingCounts 只计未完成任务，无需调整
    return completedIds
  },

  removePendingCount(id: number) {
    delete this._pendingCountsCache[id]
  }
})
