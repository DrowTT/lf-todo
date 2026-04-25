import type { Task } from '../../../shared/types/models'
import type { SystemTaskViewKey } from './taskNavigation'
import { hasTaskDue } from './taskDue'

const DAY_MS = 24 * 60 * 60 * 1000
const UPCOMING_DAYS = 7

export function filterTasksForSystemView(
  tasks: Task[],
  view: SystemTaskViewKey,
  nowMs = Date.now()
): Task[] {
  const rootTasks = tasks.filter((task) => task.parent_id === null)

  if (view === 'all') {
    return rootTasks
  }

  if (view === 'today') {
    return rootTasks.filter((task) => !task.is_completed && isTaskDueOnDay(task, nowMs))
  }

  if (view === 'upcoming') {
    return sortByDueAt(
      rootTasks.filter((task) => !task.is_completed && isTaskDueBeforeWindowEnd(task, nowMs))
    )
  }

  if (view === 'open') {
    return rootTasks.filter((task) => !task.is_completed)
  }

  if (view === 'highPriority') {
    return rootTasks.filter((task) => !task.is_completed && task.priority === 'high')
  }

  return [...rootTasks].sort((left, right) => right.created_at - left.created_at || right.id - left.id)
}

function isTaskDueOnDay(task: Task, nowMs: number): boolean {
  if (!hasTaskDue(task)) {
    return false
  }

  const start = getDayStart(nowMs)
  const end = start + DAY_MS
  const dueMs = task.due_at * 1000
  return dueMs >= start && dueMs < end
}

function isTaskDueBeforeWindowEnd(task: Task, nowMs: number): boolean {
  if (!hasTaskDue(task)) {
    return false
  }

  const windowEnd = getDayStart(nowMs) + UPCOMING_DAYS * DAY_MS + DAY_MS
  return task.due_at * 1000 < windowEnd
}

function sortByDueAt(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const leftDueAt = left.due_at ?? Number.MAX_SAFE_INTEGER
    const rightDueAt = right.due_at ?? Number.MAX_SAFE_INTEGER
    return leftDueAt - rightDueAt || right.priority.localeCompare(left.priority) || left.id - right.id
  })
}

function getDayStart(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
