import { reactive } from 'vue'
import { db, Task } from '../db'
import { taskStore } from './task'
import { useToast } from '../composables/useToast'

// ─── 展开状态持久化辅助 ─────────────────────────────────────────
// 统一的 localStorage 键名前缀：lf-todo:（参见 useSidebarResize.ts 和 categoryStore）
const expandedKey = (categoryId: number) => `lf-todo:expanded-${categoryId}`

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

const toast = useToast()

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
    try {
      this.subTasksMap[parentId] = await db.getSubTasks(parentId)
    } catch (e) {
      console.error('[subTaskStore] fetchSubTasks 失败:', e)
      throw e
    }
  },

  /** 优化 #5：并行加载所有已展开子任务，避免 N 次串行 IPC 往返 */
  async fetchExpandedSubTasks(expandedIds: Set<number>) {
    const needed = [...expandedIds].filter((id) => !this.subTasksMap[id])
    await Promise.all(needed.map((id) => this.fetchSubTasks(id)))
  },

  async toggleExpand(taskId: number, categoryId: number) {
    // Vue 3 reactive 对 Set 有原生代理支持，直接 .add()/.delete() 即可触发联动
    // 参考：https://vuejs.org/guide/extras/reactivity-in-depth.html
    if (this.expandedTaskIds.has(taskId)) {
      this.expandedTaskIds.delete(taskId)
    } else {
      if (!this.subTasksMap[taskId]) {
        try {
          await this.fetchSubTasks(taskId)
        } catch (e) {
          toast.show('加载子任务失败，请重试')
          return
        }
      }
      this.expandedTaskIds.add(taskId)
    }
    this._persistExpanded(categoryId)
  },

  /**
   * 优化 #2：直接引用 taskStore.tasks，消除 tasks 参数透传和 (parent as any) 强转
   */
  async addSubTask(content: string, parentId: number) {
    try {
      const newSubTask = await db.createSubTask(content, parentId)
      if (!this.subTasksMap[parentId]) {
        this.subTasksMap[parentId] = []
      }
      this.subTasksMap[parentId] = [...this.subTasksMap[parentId], newSubTask]
      // 更新父任务统计字段
      const parent = taskStore.tasks.find((t) => t.id === parentId)
      if (parent) {
        parent.subtask_total = (parent.subtask_total ?? 0) + 1
      }
    } catch (e) {
      console.error('[subTaskStore] addSubTask 失败:', e)
      toast.show('创建子任务失败，请重试')
      throw e
    }
  },

  async toggleSubTask(id: number, parentId: number) {
    const list = this.subTasksMap[parentId]
    const sub = list?.find((t) => t.id === id)
    if (!sub) return
    const newCompleted = !sub.is_completed
    // 乐观更新 UI — fire-and-forget
    sub.is_completed = newCompleted
    const parent = taskStore.tasks.find((t) => t.id === parentId)
    if (parent) {
      parent.subtask_done = (parent.subtask_done ?? 0) + (newCompleted ? 1 : -1)
    }
    db.toggleTaskComplete(id).catch((e) =>
      console.error('[subTaskStore] toggleSubTask IPC 失败:', e)
    )
  },

  async deleteSubTask(id: number, parentId: number) {
    const list = this.subTasksMap[parentId]
    if (!list) return
    const sub = list.find((t) => t.id === id)
    // 乐观删除 UI — fire-and-forget
    this.subTasksMap[parentId] = list.filter((t) => t.id !== id)
    const parent = taskStore.tasks.find((t) => t.id === parentId)
    if (parent) {
      parent.subtask_total = Math.max(0, (parent.subtask_total ?? 0) - 1)
      if (sub?.is_completed) {
        parent.subtask_done = Math.max(0, (parent.subtask_done ?? 0) - 1)
      }
    }
    db.deleteTask(id).catch((e) => console.error('[subTaskStore] deleteSubTask IPC 失败:', e))
  },

  async updateSubTaskContent(id: number, parentId: number, content: string) {
    const list = this.subTasksMap[parentId]
    const sub = list?.find((t) => t.id === id)
    if (sub) sub.content = content
    // 乐观更新 UI — fire-and-forget
    db.updateTask(id, { content }).catch((e) =>
      console.error('[subTaskStore] updateSubTaskContent IPC 失败:', e)
    )
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
