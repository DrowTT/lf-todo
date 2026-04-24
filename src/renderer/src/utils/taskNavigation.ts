import { SYSTEM_CATEGORY_NAME } from '../../../shared/constants/category'
import type { Category } from '../../../shared/types/models'

export const ALL_TASKS_VIEW_KEY = 'all'
export const ALL_TASKS_VIEW_LABEL = '全部'
export const ARCHIVE_TASK_VIEW_LABEL = '已归档待办'

export type TaskPaneView = 'active' | 'archive'
export type TaskListView = 'category' | 'all'
export type CategoryTaskView = {
  kind: 'category'
  categoryId: number | null
}
export type SystemTaskView = {
  kind: 'system'
  view: 'all'
}
export type HistoryTaskView = {
  kind: 'history'
  view: 'archive'
}
export type TaskView = CategoryTaskView | SystemTaskView | HistoryTaskView
export type TaskViewScopeKey = number | typeof ALL_TASKS_VIEW_KEY
export type TaskListStorageKey = TaskViewScopeKey

export const ALL_TASKS_TASK_VIEW: SystemTaskView = {
  kind: 'system',
  view: 'all'
}

export const ARCHIVE_TASK_VIEW: HistoryTaskView = {
  kind: 'history',
  view: 'archive'
}

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

  if (record.kind === 'system' && record.view === 'all') {
    return ALL_TASKS_TASK_VIEW
  }

  if (record.kind === 'history' && record.view === 'archive') {
    return ARCHIVE_TASK_VIEW
  }

  if (record.kind === 'category') {
    return createCategoryTaskView(
      typeof record.categoryId === 'number' ? record.categoryId : null
    )
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

export function isArchiveTaskView(view: TaskView): view is HistoryTaskView {
  return view.kind === 'history' && view.view === 'archive'
}

export function getTaskPaneView(view: TaskView): TaskPaneView {
  return isArchiveTaskView(view) ? 'archive' : 'active'
}

export function getTaskListView(view: TaskView): TaskListView {
  return isAllTasksTaskView(view) ? 'all' : 'category'
}

export function getTaskViewScopeKey(view: TaskView): TaskViewScopeKey | null {
  if (isArchiveTaskView(view)) {
    return null
  }

  if (isAllTasksTaskView(view)) {
    return ALL_TASKS_VIEW_KEY
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

  if (isAllTasksTaskView(view)) {
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

  if (isAllTasksTaskView(view)) {
    return ALL_TASKS_VIEW_LABEL
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
