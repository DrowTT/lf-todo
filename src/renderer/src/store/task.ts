import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db, Task } from '../db'
import { useToast } from '../composables/useToast'

/**
 * 任务 Store（Pinia setup store）
 */
export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)

  // ─── pendingCounts（初始从 IPC 拉取，后续本地维护，消除冗余 IPC）
  const pendingCounts = ref<Record<number, number>>({})

  const toast = useToast()

  function _adjustPendingCount(categoryId: number, delta: number) {
    const cur = pendingCounts.value[categoryId] ?? 0
    pendingCounts.value[categoryId] = Math.max(0, cur + delta)
  }

  async function initPendingCounts() {
    try {
      pendingCounts.value = await db.getPendingTaskCounts()
    } catch (e) {
      console.error('[taskStore] initPendingCounts 失败:', e)
      // 初始化失败不阻塞主流程，仅记录日志
    }
  }

  async function fetchTasks(categoryId: number) {
    isLoading.value = true
    try {
      tasks.value = await db.getTasks(categoryId)
      // 以实际数据校正当前分类的 pending 数
      const pending = tasks.value.filter((t) => !t.is_completed && t.parent_id === null).length
      pendingCounts.value[categoryId] = pending
    } catch (e) {
      console.error('[taskStore] fetchTasks 失败:', e)
      toast.show('加载任务列表失败，请重试')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function clearTasks() {
    tasks.value = []
  }

  async function addTask(content: string, categoryId: number) {
    try {
      const newTask = await db.createTask(content, categoryId)
      // 乐观插入（ORDER BY order_index DESC，新任务排最前）
      tasks.value.unshift({ ...newTask, subtask_total: 0, subtask_done: 0 })
      _adjustPendingCount(categoryId, 1)
    } catch (e) {
      console.error('[taskStore] addTask 失败:', e)
      toast.show('创建任务失败，请重试')
      throw e
    }
  }

  async function toggleTask(id: number, categoryId: number) {
    const task = tasks.value.find((t) => t.id === id)
    if (!task) return
    const newCompleted = !task.is_completed
    // 乐观更新 UI — fire-and-forget
    task.is_completed = newCompleted
    _adjustPendingCount(categoryId, newCompleted ? -1 : 1)
    db.toggleTaskComplete(id).catch((e) => console.error('[taskStore] toggleTask IPC 失败:', e))
  }

  async function deleteTask(id: number, categoryId: number) {
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx === -1) return
    const task = tasks.value[idx]
    if (!task.is_completed) _adjustPendingCount(categoryId, -1)
    // 乐观删除 UI — fire-and-forget
    tasks.value.splice(idx, 1)
    db.deleteTask(id).catch((e) => console.error('[taskStore] deleteTask IPC 失败:', e))
  }

  async function updateTaskContent(id: number, content: string) {
    const task = tasks.value.find((t) => t.id === id)
    if (task) task.content = content
    // 乐观更新 UI — fire-and-forget
    db.updateTask(id, { content }).catch((e) =>
      console.error('[taskStore] updateTaskContent IPC 失败:', e)
    )
  }

  async function clearCompletedTasks() {
    const completedIds = tasks.value.filter((t) => t.is_completed).map((t) => t.id)
    if (completedIds.length === 0) return undefined
    const completedSet = new Set(completedIds)
    // 乐观删除 UI — fire-and-forget
    tasks.value = tasks.value.filter((t) => !completedSet.has(t.id))
    db.deleteTasks(completedIds).catch((e) =>
      console.error('[taskStore] clearCompletedTasks IPC 失败:', e)
    )
    return completedIds
  }

  function removePendingCount(id: number) {
    delete pendingCounts.value[id]
  }

  return {
    tasks,
    isLoading,
    pendingCounts,
    initPendingCounts,
    fetchTasks,
    clearTasks,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskContent,
    clearCompletedTasks,
    removePendingCount
  }
})
