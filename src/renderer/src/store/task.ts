import { reactive } from 'vue'
import { db, Task } from '../db'
import { useToast } from '../composables/useToast'

const toast = useToast()

export const taskStore = reactive({
  tasks: [] as Task[],
  isLoading: false,

  // ─── pendingCounts（初始从 IPC 拉取，后续本地维护，消除冗余 IPC）
  pendingCounts: {} as Record<number, number>,

  _adjustPendingCount(categoryId: number, delta: number) {
    const cur = this.pendingCounts[categoryId] ?? 0
    this.pendingCounts[categoryId] = Math.max(0, cur + delta)
  },

  async initPendingCounts() {
    try {
      this.pendingCounts = await db.getPendingTaskCounts()
    } catch (e) {
      console.error('[taskStore] initPendingCounts 失败:', e)
      // 初始化失败不阻塞主流程，仅记录日志
    }
  },

  async fetchTasks(categoryId: number) {
    this.isLoading = true
    try {
      this.tasks = await db.getTasks(categoryId)
      // 以实际数据校正当前分类的 pending 数
      const pending = this.tasks.filter((t) => !t.is_completed && t.parent_id === null).length
      this.pendingCounts[categoryId] = pending
    } catch (e) {
      console.error('[taskStore] fetchTasks 失败:', e)
      toast.show('加载任务列表失败，请重试')
      throw e
    } finally {
      this.isLoading = false
    }
  },

  clearTasks() {
    this.tasks = []
  },

  async addTask(content: string, categoryId: number) {
    try {
      const newTask = await db.createTask(content, categoryId)
      // 乐观插入（ORDER BY order_index DESC，新任务排最前）
      this.tasks.unshift({
        ...newTask,
        subtask_total: 0,
        subtask_done: 0
      })
      this._adjustPendingCount(categoryId, 1)
    } catch (e) {
      console.error('[taskStore] addTask 失败:', e)
      toast.show('创建任务失败，请重试')
      throw e
    }
  },

  async toggleTask(id: number, categoryId: number) {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return
    const newCompleted = !task.is_completed
    // 乐观更新 UI — fire-and-forget
    task.is_completed = newCompleted
    this._adjustPendingCount(categoryId, newCompleted ? -1 : 1)
    db.toggleTaskComplete(id).catch((e) => console.error('[taskStore] toggleTask IPC 失败:', e))
  },

  async deleteTask(id: number, categoryId: number) {
    const idx = this.tasks.findIndex((t) => t.id === id)
    if (idx === -1) return
    const task = this.tasks[idx]
    if (!task.is_completed) {
      this._adjustPendingCount(categoryId, -1)
    }
    // 乐观删除 UI — fire-and-forget
    this.tasks.splice(idx, 1)
    db.deleteTask(id).catch((e) => console.error('[taskStore] deleteTask IPC 失败:', e))
  },

  async updateTaskContent(id: number, content: string) {
    const task = this.tasks.find((t) => t.id === id)
    if (task) task.content = content
    // 乐观更新 UI — fire-and-forget
    db.updateTask(id, { content }).catch((e) =>
      console.error('[taskStore] updateTaskContent IPC 失败:', e)
    )
  },

  async clearCompletedTasks() {
    const completedIds = this.tasks.filter((t) => t.is_completed).map((t) => t.id)
    if (completedIds.length === 0) return
    const completedSet = new Set(completedIds)
    // 乐观删除 UI — fire-and-forget
    this.tasks = this.tasks.filter((t) => !completedSet.has(t.id))
    db.deleteTasks(completedIds).catch((e) =>
      console.error('[taskStore] clearCompletedTasks IPC 失败:', e)
    )
    // pendingCounts 只计未完成任务，无需调整
    return completedIds
  },

  removePendingCount(id: number) {
    delete this.pendingCounts[id]
  }
})
