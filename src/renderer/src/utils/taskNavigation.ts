import { SYSTEM_CATEGORY_NAME } from '../../../shared/constants/category'
import type { Category } from '../../../shared/types/models'

export const ALL_TASKS_VIEW_KEY = 'all'
export const ALL_TASKS_VIEW_LABEL = '全部'

export type TaskListStorageKey = number | typeof ALL_TASKS_VIEW_KEY

export function getTaskListStorageKey(
  taskListView: 'category' | 'all',
  categoryId: number | null
): TaskListStorageKey | null {
  if (taskListView === 'all') {
    return ALL_TASKS_VIEW_KEY
  }

  return categoryId
}

export function getCategoryDisplayName(
  category: Pick<Category, 'name' | 'is_system'> | null | undefined
): string {
  if (!category) {
    return ''
  }

  return category.is_system ? SYSTEM_CATEGORY_NAME : category.name
}
