import { SYSTEM_CATEGORY_NAME } from '../../../shared/constants/category'
import type { Category } from '../../../shared/types/models'

export const ALL_TASKS_VIEW_KEY = 'all'
export const ALL_TASKS_VIEW_LABEL = '全部'
export const ALL_TASKS_VIEW_DESCRIPTION = '聚合所有未归档任务，不作为默认捕获落点'
export const TODAY_TASKS_VIEW_LABEL = '今天'
export const TODAY_TASKS_VIEW_DESCRIPTION = '今天到期或需要今天处理的未完成任务'
export const UPCOMING_TASKS_VIEW_LABEL = '即将到期'
export const UPCOMING_TASKS_VIEW_DESCRIPTION = '已逾期与未来 7 天内到期的未完成任务'
export const OPEN_TASKS_VIEW_LABEL = '全部未完成'
export const OPEN_TASKS_VIEW_DESCRIPTION = '跨分类查看所有未完成任务'
export const HIGH_PRIORITY_TASKS_VIEW_LABEL = '高优先级'
export const HIGH_PRIORITY_TASKS_VIEW_DESCRIPTION = '跨分类查看所有未完成的高优先级任务'
export const RECENT_TASKS_VIEW_LABEL = '最近创建'
export const RECENT_TASKS_VIEW_DESCRIPTION = '按创建时间倒序查看最近加入的任务'
export const INBOX_CAPTURE_LABEL = SYSTEM_CATEGORY_NAME
export const INBOX_CAPTURE_DESCRIPTION = '默认捕获落点，适合先收集再整理'
export const ARCHIVE_TASK_VIEW_LABEL = '已归档'
export const ARCHIVE_TASK_VIEW_DESCRIPTION = '历史区，用于回看和恢复已归档任务'

export type SystemTaskViewKey = 'all' | 'today' | 'upcoming' | 'open' | 'highPriority' | 'recent'

export type TaskPaneView = 'active' | 'archive'
export type TaskListView = 'category' | 'all'
export type CategoryTaskView = {
  kind: 'category'
  categoryId: number | null
}
export type SystemTaskView = {
  kind: 'system'
  view: SystemTaskViewKey
}
export type HistoryTaskView = {
  kind: 'history'
  view: 'archive'
}
export type TaskView = CategoryTaskView | SystemTaskView | HistoryTaskView
export type TaskViewScopeKey = number | SystemTaskViewKey
export type TaskListStorageKey = TaskViewScopeKey

export const ALL_TASKS_TASK_VIEW: SystemTaskView = {
  kind: 'system',
  view: 'all'
}

export const TODAY_TASKS_TASK_VIEW: SystemTaskView = {
  kind: 'system',
  view: 'today'
}

export const UPCOMING_TASKS_TASK_VIEW: SystemTaskView = {
  kind: 'system',
  view: 'upcoming'
}

export const OPEN_TASKS_TASK_VIEW: SystemTaskView = {
  kind: 'system',
  view: 'open'
}

export const HIGH_PRIORITY_TASKS_TASK_VIEW: SystemTaskView = {
  kind: 'system',
  view: 'highPriority'
}

export const RECENT_TASKS_TASK_VIEW: SystemTaskView = {
  kind: 'system',
  view: 'recent'
}

export const ARCHIVE_TASK_VIEW: HistoryTaskView = {
  kind: 'history',
  view: 'archive'
}

export const SYSTEM_TASK_VIEW_DEFINITIONS = {
  all: {
    view: ALL_TASKS_TASK_VIEW,
    label: ALL_TASKS_VIEW_LABEL,
    description: ALL_TASKS_VIEW_DESCRIPTION
  },
  today: {
    view: TODAY_TASKS_TASK_VIEW,
    label: TODAY_TASKS_VIEW_LABEL,
    description: TODAY_TASKS_VIEW_DESCRIPTION
  },
  upcoming: {
    view: UPCOMING_TASKS_TASK_VIEW,
    label: UPCOMING_TASKS_VIEW_LABEL,
    description: UPCOMING_TASKS_VIEW_DESCRIPTION
  },
  open: {
    view: OPEN_TASKS_TASK_VIEW,
    label: OPEN_TASKS_VIEW_LABEL,
    description: OPEN_TASKS_VIEW_DESCRIPTION
  },
  highPriority: {
    view: HIGH_PRIORITY_TASKS_TASK_VIEW,
    label: HIGH_PRIORITY_TASKS_VIEW_LABEL,
    description: HIGH_PRIORITY_TASKS_VIEW_DESCRIPTION
  },
  recent: {
    view: RECENT_TASKS_TASK_VIEW,
    label: RECENT_TASKS_VIEW_LABEL,
    description: RECENT_TASKS_VIEW_DESCRIPTION
  }
} as const

export const HISTORY_TASK_VIEW_DEFINITIONS = {
  archive: {
    view: ARCHIVE_TASK_VIEW,
    label: ARCHIVE_TASK_VIEW_LABEL,
    description: ARCHIVE_TASK_VIEW_DESCRIPTION
  }
} as const

export function createCategoryTaskView(categoryId: number | null): CategoryTaskView {
  return {
    kind: 'category',
    categoryId
  }
}

export function normalizeTaskView(value: unknown, fallback: TaskView): TaskView {
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const record = value as Record<string, unknown>

  if (record.kind === 'system' && typeof record.view === 'string') {
    return SYSTEM_TASK_VIEW_DEFINITIONS[record.view as SystemTaskViewKey]?.view ?? fallback
  }

  if (record.kind === 'history' && record.view === 'archive') {
    return ARCHIVE_TASK_VIEW
  }

  if (record.kind === 'category') {
    return createCategoryTaskView(typeof record.categoryId === 'number' ? record.categoryId : null)
  }

  return fallback
}

export function buildTaskViewFromLegacyState(options: {
  taskPaneView: TaskPaneView
  taskListView: TaskListView
  categoryId: number | null
}): TaskView {
  if (options.taskPaneView === 'archive') {
    return ARCHIVE_TASK_VIEW
  }

  if (options.taskListView === 'all') {
    return ALL_TASKS_TASK_VIEW
  }

  return createCategoryTaskView(options.categoryId)
}

export function isTaskViewEqual(left: TaskView, right: TaskView): boolean {
  if (left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'category' && right.kind === 'category') {
    return left.categoryId === right.categoryId
  }

  if (left.kind === 'system' && right.kind === 'system') {
    return left.view === right.view
  }

  if (left.kind === 'history' && right.kind === 'history') {
    return left.view === right.view
  }

  return false
}

export function isCategoryTaskView(view: TaskView): view is CategoryTaskView {
  return view.kind === 'category'
}

export function isResolvedCategoryTaskView(
  view: TaskView
): view is CategoryTaskView & { categoryId: number } {
  return view.kind === 'category' && view.categoryId !== null
}

export function isAllTasksTaskView(view: TaskView): view is SystemTaskView {
  return view.kind === 'system' && view.view === 'all'
}

export function isSystemTaskView(view: TaskView): view is SystemTaskView {
  return view.kind === 'system'
}

export function isArchiveTaskView(view: TaskView): view is HistoryTaskView {
  return view.kind === 'history' && view.view === 'archive'
}

export function getTaskPaneView(view: TaskView): TaskPaneView {
  return isArchiveTaskView(view) ? 'archive' : 'active'
}

export function getTaskListView(view: TaskView): TaskListView {
  return isSystemTaskView(view) ? 'all' : 'category'
}

export function getTaskViewScopeKey(view: TaskView): TaskViewScopeKey | null {
  if (isArchiveTaskView(view)) {
    return null
  }

  if (isSystemTaskView(view)) {
    return view.view
  }

  return view.categoryId
}

export function getTaskListStorageKey(
  taskListView: TaskListView,
  categoryId: number | null
): TaskListStorageKey | null {
  return getTaskViewScopeKey(
    buildTaskViewFromLegacyState({
      taskPaneView: 'active',
      taskListView,
      categoryId
    })
  )
}

export function getTaskViewCreateCategoryId(
  view: TaskView,
  inboxCategoryId: number | null
): number | null {
  if (isArchiveTaskView(view)) {
    return null
  }

  if (isSystemTaskView(view)) {
    return inboxCategoryId
  }

  return view.categoryId
}

export function getTaskViewLabel(
  view: TaskView,
  options: {
    category?: Pick<Category, 'name' | 'is_system'> | null
    emptyCategoryLabel?: string
  } = {}
): string {
  if (isArchiveTaskView(view)) {
    return ARCHIVE_TASK_VIEW_LABEL
  }

  if (isSystemTaskView(view)) {
    return SYSTEM_TASK_VIEW_DEFINITIONS[view.view].label
  }

  return getCategoryDisplayName(options.category) || options.emptyCategoryLabel || '未选择分类'
}

export function getCategoryDisplayName(
  category: Pick<Category, 'name' | 'is_system'> | null | undefined
): string {
  if (!category) {
    return ''
  }

  return category.is_system ? SYSTEM_CATEGORY_NAME : category.name
}
