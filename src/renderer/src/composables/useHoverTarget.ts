import { reactive, computed } from 'vue'

/**
 * 悬停目标类型定义
 */
export interface HoverTarget {
  /** 悬停类型：一级待办 / 子待办 / 无 */
  type: 'task' | 'subtask' | null
  /** 当前悬停的任务 ID */
  taskId: number | null
  /** 子任务所属的父级任务 ID（仅 subtask 类型） */
  parentId: number | null
}

// 全局单例状态：整个应用共享同一个悬停目标
const hoveredTarget = reactive<HoverTarget>({
  type: null,
  taskId: null,
  parentId: null
})

/**
 * 鼠标悬停目标追踪 composable
 *
 * 用于记录当前鼠标悬停在哪个待办/子待办上，
 * 供快捷键系统判断操作对象。
 */
export function useHoverTarget() {
  /** 设置悬停目标为一级待办 */
  const setHoverTask = (taskId: number) => {
    hoveredTarget.type = 'task'
    hoveredTarget.taskId = taskId
    hoveredTarget.parentId = null
  }

  /** 设置悬停目标为子待办 */
  const setHoverSubTask = (taskId: number, parentId: number) => {
    hoveredTarget.type = 'subtask'
    hoveredTarget.taskId = taskId
    hoveredTarget.parentId = parentId
  }

  /** 清空悬停目标 */
  const clearHover = () => {
    hoveredTarget.type = null
    hoveredTarget.taskId = null
    hoveredTarget.parentId = null
  }

  /** 当前悬停的一级任务 ID（子待办时返回其 parentId） */
  const hoveredParentTaskId = computed(() => {
    if (hoveredTarget.type === 'task') return hoveredTarget.taskId
    if (hoveredTarget.type === 'subtask') return hoveredTarget.parentId
    return null
  })

  return {
    hoveredTarget,
    hoveredParentTaskId,
    setHoverTask,
    setHoverSubTask,
    clearHover
  }
}
