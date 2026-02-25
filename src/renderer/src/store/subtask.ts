import { reactive } from 'vue'
import { db, Task } from '../db'

// ─── 展开状态持久化辅助 ─────────────────────────────────────────
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
// ────────────────────────────────────────────────────────────────

export const subTaskStore = reactive({
  subTasksMap: {} as Record<number, Task[]>,
  expandedTaskIds: new Set<number>(),

  reset() {
    this.subTasksMap = {}
    this.expandedTaskIds = new Set()
  },

  loadExpandedForCategory(categoryId: number) {
    this.expandedTaskIds = loadExpandedIds(categoryId)
  },

  _persistExpanded(categoryId: number) {
    saveExpandedIds(categoryId, this.expandedTaskIds)
  },

  async fetchSubTasks(parentId: number) {
    this.subTasksMap[parentId] = await db.getSubTasks(parentId)
  },

  async fetchExpandedSubTasks(expandedIds: Set<number>) {
    for (const taskId of expandedIds) {
      if (!this.subTasksMap[taskId]) {
        await this.fetchSubTasks(taskId)
      }
    }
  },

  async toggleExpand(taskId: number, categoryId: number) {
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
    this._persistExpanded(categoryId)
  },

  async addSubTask(
    content: string,
    parentId: number,
    tasks: { id: number; subtask_total?: number }[]
  ) {
    const newSubTask = await db.createSubTask(content, parentId)
    if (!this.subTasksMap[parentId]) {
      this.subTasksMap[parentId] = []
    }
    this.subTasksMap[parentId] = [...this.subTasksMap[parentId], newSubTask]
    // 更新父任务统计字段
    const parent = tasks.find((t) => t.id === parentId)
    if (parent) {
      ;(parent as any).subtask_total = ((parent as any).subtask_total ?? 0) + 1
    }
  },

  async toggleSubTask(
    id: number,
    parentId: number,
    tasks: { id: number; subtask_done?: number }[]
  ) {
    const list = this.subTasksMap[parentId]
    const sub = list?.find((t) => t.id === id)
    if (!sub) return
    const newCompleted = !sub.is_completed
    sub.is_completed = newCompleted
    const parent = tasks.find((t) => t.id === parentId)
    if (parent) {
      ;(parent as any).subtask_done = ((parent as any).subtask_done ?? 0) + (newCompleted ? 1 : -1)
    }
    db.toggleTaskComplete(id)
  },

  async deleteSubTask(
    id: number,
    parentId: number,
    tasks: { id: number; subtask_total?: number; subtask_done?: number }[]
  ) {
    const list = this.subTasksMap[parentId]
    if (!list) return
    const sub = list.find((t) => t.id === id)
    this.subTasksMap[parentId] = list.filter((t) => t.id !== id)
    const parent = tasks.find((t) => t.id === parentId)
    if (parent) {
      ;(parent as any).subtask_total = Math.max(0, ((parent as any).subtask_total ?? 0) - 1)
      if (sub?.is_completed) {
        ;(parent as any).subtask_done = Math.max(0, ((parent as any).subtask_done ?? 0) - 1)
      }
    }
    db.deleteTask(id)
  },

  async updateSubTaskContent(id: number, parentId: number, content: string) {
    const list = this.subTasksMap[parentId]
    const sub = list?.find((t) => t.id === id)
    if (sub) sub.content = content
    db.updateTask(id, { content })
  },

  removeTask(id: number, categoryId: number) {
    delete this.subTasksMap[id]
    if (this.expandedTaskIds.has(id)) {
      this.expandedTaskIds.delete(id)
      this._persistExpanded(categoryId)
    }
  },

  removeCompletedTasks(ids: number[], categoryId: number) {
    ids.forEach((id) => {
      delete this.subTasksMap[id]
      this.expandedTaskIds.delete(id)
    })
    this._persistExpanded(categoryId)
  }
})
