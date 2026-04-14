import type { TaskDuePrecision, TaskDueState } from '../../../shared/types/models'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type TaskDueTone = 'empty' | 'scheduled' | 'today' | 'overdue' | 'done'
type ResolvedTaskDueState = TaskDueState & { due_at: number; due_precision: TaskDuePrecision }

export const EMPTY_TASK_DUE_STATE: TaskDueState = {
  due_at: null,
  due_precision: null
}

export function cloneTaskDueState(value?: Partial<TaskDueState> | null): TaskDueState {
  return {
    due_at: typeof value?.due_at === 'number' ? value.due_at : null,
    due_precision:
      value?.due_precision === 'date' || value?.due_precision === 'datetime'
        ? value.due_precision
        : null
  }
}

export function hasTaskDue(value?: Partial<TaskDueState> | null): value is ResolvedTaskDueState {
  return (
    typeof value?.due_at === 'number' &&
    (value.due_precision === 'date' || value.due_precision === 'datetime')
  )
}

export function formatTaskDueDateInputValue(value?: Partial<TaskDueState> | null): string {
  if (!hasTaskDue(value)) {
    return ''
  }

  return formatDateInputValue(new Date(value.due_at * SECOND))
}

export function formatTaskDueTimeInputValue(value?: Partial<TaskDueState> | null): string {
  if (!hasTaskDue(value) || value.due_precision !== 'datetime') {
    return '18:00'
  }

  const date = new Date(value.due_at * SECOND)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function createTaskDueStateFromInputs(
  dateValue: string,
  includeTime: boolean,
  timeValue: string
): TaskDueState | null {
  if (!dateValue) {
    return null
  }

  const [yearText, monthText, dayText] = dateValue.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (![year, month, day].every(Number.isInteger)) {
    return null
  }

  const dueDate = new Date(year, month - 1, day, 0, 0, 0, 0)
  let duePrecision: TaskDuePrecision = 'date'

  if (includeTime) {
    const [hourText, minuteText] = (timeValue || '18:00').split(':')
    const hour = Number(hourText)
    const minute = Number(minuteText)

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      return null
    }

    dueDate.setHours(hour, minute, 0, 0)
    duePrecision = 'datetime'
  }

  return {
    due_at: Math.floor(dueDate.getTime() / SECOND),
    due_precision: duePrecision
  }
}

export function getTaskDueTone(
  value: Partial<TaskDueState> | null | undefined,
  completed: boolean,
  nowMs = Date.now()
): TaskDueTone {
  if (!hasTaskDue(value)) {
    return 'empty'
  }

  if (completed) {
    return 'done'
  }

  if (isTaskDueOverdue(value, nowMs)) {
    return 'overdue'
  }

  if (isTaskDueToday(value, nowMs)) {
    return 'today'
  }

  return 'scheduled'
}

export function formatTaskDueLabel(
  value: Partial<TaskDueState> | null | undefined,
  nowMs = Date.now()
): string {
  if (!hasTaskDue(value)) {
    return ''
  }

  if (isTaskDueOverdue(value, nowMs)) {
    return formatTaskDueOverdueLabel(value, nowMs)
  }

  const dueDate = new Date(value.due_at * SECOND)
  const dayLabel = formatRelativeDayLabel(dueDate.getTime(), nowMs)

  if (value.due_precision === 'date') {
    return dayLabel
  }

  return `${dayLabel} ${pad(dueDate.getHours())}:${pad(dueDate.getMinutes())}`
}

export function formatTaskDueTitle(value: Partial<TaskDueState> | null | undefined): string {
  if (!hasTaskDue(value)) {
    return '未设置截止日期'
  }

  const dueDate = new Date(value.due_at * SECOND)
  const base = `${dueDate.getFullYear()}年${dueDate.getMonth() + 1}月${dueDate.getDate()}日`

  if (value.due_precision === 'date') {
    return `截止日期：${base}`
  }

  return `截止时间：${base} ${pad(dueDate.getHours())}:${pad(dueDate.getMinutes())}`
}

export function isTaskDueToday(
  value: Partial<TaskDueState> | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!hasTaskDue(value)) {
    return false
  }

  return getDayDiff(value.due_at * SECOND, nowMs) === 0
}

export function isTaskDueOverdue(
  value: Partial<TaskDueState> | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!hasTaskDue(value)) {
    return false
  }

  return nowMs > getTaskDueBoundaryMs(value)
}

function formatTaskDueOverdueLabel(value: ResolvedTaskDueState, nowMs: number): string {
  const overdueMs = nowMs - getTaskDueBoundaryMs(value)

  if (value.due_precision === 'datetime' && overdueMs < DAY) {
    if (overdueMs < HOUR) {
      return '已逾期'
    }

    return `已逾期 ${Math.max(1, Math.ceil(overdueMs / HOUR))} 小时`
  }

  return `已逾期 ${Math.max(1, Math.ceil(overdueMs / DAY))} 天`
}

function formatRelativeDayLabel(targetMs: number, nowMs: number): string {
  const diffDays = getDayDiff(targetMs, nowMs)
  const targetDate = new Date(targetMs)

  if (diffDays === 0) {
    return '今天'
  }

  if (diffDays === 1) {
    return '明天'
  }

  if (diffDays === -1) {
    return '昨天'
  }

  if (targetDate.getFullYear() === new Date(nowMs).getFullYear()) {
    return `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
  }

  return `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
}

function getTaskDueBoundaryMs(value: ResolvedTaskDueState): number {
  const dueDate = new Date(value.due_at * SECOND)

  if (value.due_precision === 'datetime') {
    return dueDate.getTime()
  }

  dueDate.setHours(23, 59, 59, 999)
  return dueDate.getTime()
}

function getDayDiff(targetMs: number, nowMs: number): number {
  return Math.round((getDayStart(targetMs) - getDayStart(nowMs)) / DAY)
}

function getDayStart(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function formatDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
