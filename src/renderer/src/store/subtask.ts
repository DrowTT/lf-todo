import { ref } from 'vue'
import { defineStore } from 'pinia'
import { db, Task } from '../db'
import { useTaskStore } from './task'
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

/**
 * 子任务 Store（Pinia setup store）
 *
 * expandedTaskIds 使用 ref 包裹 Set 而非直接放入 reactive，
 * 避免 reactive 内嵌 Set 在某些边缘场景下响应跟踪丢失的问题。
 * 通过 ref 包裹，每次 .add() / .delete() 只需重新赋值包装对象即可
 * 触发依赖收集（参见 toggleExpand 实现）。
 */
export const useSubTaskStore = defineStore('subTask', () => {
  const subTasksMap = ref<Record<number, Task[]>>({})
  // 用 ref 包裹 Set，通过替换整个 Set 触发响应（确保视图更新）
  const expandedTaskIds = ref(new Set<number>())

  const toast = useToast()

  function reset() {
    subTasksMap.value = {}
    expandedTaskIds.value = new Set()
  }

  function loadExpandedForCategory(categoryId: number) {
    expandedTaskIds.value = loadExpandedIds(categoryId)
  }

  function _persistExpanded(categoryId: number) {
    saveExpandedIds(categoryId, expandedTaskIds.value)
  }

  async function fetchSubTasks(parentId: number) {
    try {
      subTasksMap.value[parentId] = await db.getSubTasks(parentId)
    } catch (e) {
      console.error('[subTaskStore] fetchSubTasks 失败:', e)
      throw e
    }
  }

  /** 并行加载所有已展开子任务，避免 N 次串行 IPC 往返（优化 #5） */
  async function fetchExpandedSubTasks(expandedIds: Set<number>) {
    const needed = [...expandedIds].filter((id) => !subTasksMap.value[id])
    await Promise.all(needed.map((id) => fetchSubTasks(id)))
  }

  async function toggleExpand(taskId: number, categoryId: number) {
    if (expandedTaskIds.value.has(taskId)) {
      // 替换整个 Set 以确保 Vue 响应系统感知变更
      const next = new Set(expandedTaskIds.value)
      next.delete(taskId)
      expandedTaskIds.value = next
    } else {
      if (!subTasksMap.value[taskId]) {
        try {
          await fetchSubTasks(taskId)
        } catch {
          toast.show('加载子任务失败，请重试')
          return
        }
      }
      expandedTaskIds.value = new Set(expandedTaskIds.value).add(taskId)
    }
    _persistExpanded(categoryId)
  }

  async function addSubTask(content: string, parentId: number) {
    try {
      const newSubTask = await db.createSubTask(content, parentId)
      if (!subTasksMap.value[parentId]) {
        subTasksMap.value[parentId] = []
      }
      subTasksMap.value[parentId] = [...subTasksMap.value[parentId], newSubTask]
      // 更新父任务统计字段
      const taskStore = useTaskStore()
      const parent = taskStore.tasks.find((t) => t.id === parentId)
      if (parent) {
        parent.subtask_total = (parent.subtask_total ?? 0) + 1
        // 规则3：在已完成的主待办下新增子待办时，自动取消主待办完成状态
        if (parent.is_completed) {
          parent.is_completed = false
          taskStore._adjustPendingCount(parent.category_id, 1)
          db.setTaskCompleted(parentId, false).catch((e) =>
            console.error('[subTaskStore] 联动取消主待办完成 IPC 失败:', e)
          )
        }
      }
    } catch (e) {
      console.error('[subTaskStore] addSubTask 失败:', e)
      toast.show('创建子任务失败，请重试')
      throw e
    }
  }

  async function toggleSubTask(id: number, parentId: number) {
    const list = subTasksMap.value[parentId]
    const sub = list?.find((t) => t.id === id)
    if (!sub) return
    const newCompleted = !sub.is_completed
    // 乐观更新 UI — fire-and-forget
    sub.is_completed = newCompleted
    const taskStore = useTaskStore()
    const parent = taskStore.tasks.find((t) => t.id === parentId)
    if (parent) {
      parent.subtask_done = (parent.subtask_done ?? 0) + (newCompleted ? 1 : -1)

      // 规则2：所有子待办都完成时，自动完成主待办
      const allDone = list!.every((t) => t.is_completed)
      if (allDone && !parent.is_completed) {
        parent.is_completed = true
        taskStore._adjustPendingCount(parent.category_id, -1)
        db.setTaskCompleted(parentId, true).catch((e) =>
          console.error('[subTaskStore] 联动完成主待办 IPC 失败:', e)
        )
      }

      // 规则3：取消子待办完成时，若主待办已完成则自动取消
      if (!newCompleted && parent.is_completed) {
        parent.is_completed = false
        taskStore._adjustPendingCount(parent.category_id, 1)
        db.setTaskCompleted(parentId, false).catch((e) =>
          console.error('[subTaskStore] 联动取消主待办完成 IPC 失败:', e)
        )
      }
    }
    db.toggleTaskComplete(id).catch((e) =>
      console.error('[subTaskStore] toggleSubTask IPC 失败:', e)
    )
  }

  async function deleteSubTask(id: number, parentId: number) {
    const list = subTasksMap.value[parentId]
    if (!list) return
    const sub = list.find((t) => t.id === id)
    // 乐观删除 UI — fire-and-forget
    subTasksMap.value[parentId] = list.filter((t) => t.id !== id)
    const taskStore = useTaskStore()
    const parent = taskStore.tasks.find((t) => t.id === parentId)
    if (parent) {
      parent.subtask_total = Math.max(0, (parent.subtask_total ?? 0) - 1)
      if (sub?.is_completed) {
        parent.subtask_done = Math.max(0, (parent.subtask_done ?? 0) - 1)
      }
    }
    db.deleteTask(id).catch((e) => console.error('[subTaskStore] deleteSubTask IPC 失败:', e))
  }

  async function updateSubTaskContent(id: number, parentId: number, content: string) {
    const list = subTasksMap.value[parentId]
    const sub = list?.find((t) => t.id === id)
    if (sub) sub.content = content
    // 乐观更新 UI — fire-and-forget
    db.updateTask(id, { content }).catch((e) =>
      console.error('[subTaskStore] updateSubTaskContent IPC 失败:', e)
    )
  }

  function removeTask(id: number, categoryId: number) {
    delete subTasksMap.value[id]
    if (expandedTaskIds.value.has(id)) {
      const next = new Set(expandedTaskIds.value)
      next.delete(id)
      expandedTaskIds.value = next
      _persistExpanded(categoryId)
    }
  }

  function removeCompletedTasks(ids: number[], categoryId: number) {
    const next = new Set(expandedTaskIds.value)
    ids.forEach((id) => {
      delete subTasksMap.value[id]
      next.delete(id)
    })
    expandedTaskIds.value = next
    _persistExpanded(categoryId)
  }

  return {
    subTasksMap,
    expandedTaskIds,
    reset,
    loadExpandedForCategory,
    fetchSubTasks,
    fetchExpandedSubTasks,
    toggleExpand,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    updateSubTaskContent,
    removeTask,
    removeCompletedTasks
  }
})
