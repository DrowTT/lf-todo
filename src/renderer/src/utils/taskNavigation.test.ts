import { describe, expect, it } from 'vitest'
import { createCategory } from '../test/factories'
import {
  ALL_TASKS_TASK_VIEW,
  ARCHIVE_TASK_VIEW,
  createCategoryTaskView,
  getTaskViewCreateCategoryId,
  getTaskViewLabel,
  normalizeTaskView
} from './taskNavigation'

describe('taskNavigation 系统视图模型', () => {
  it('全部视图创建任务时落到暂存区而不是虚拟全部视图', () => {
    expect(getTaskViewCreateCategoryId(ALL_TASKS_TASK_VIEW, 1)).toBe(1)
    expect(getTaskViewCreateCategoryId(createCategoryTaskView(2), 1)).toBe(2)
    expect(getTaskViewCreateCategoryId(ARCHIVE_TASK_VIEW, 1)).toBeNull()
  })

  it('系统视图与历史视图可以从持久化数据恢复', () => {
    expect(normalizeTaskView({ kind: 'system', view: 'all' }, createCategoryTaskView(1))).toEqual(
      ALL_TASKS_TASK_VIEW
    )
    expect(normalizeTaskView({ kind: 'history', view: 'archive' }, createCategoryTaskView(1))).toEqual(
      ARCHIVE_TASK_VIEW
    )
  })

  it('系统分类显示为暂存区，全部视图显示为全部', () => {
    expect(getTaskViewLabel(ALL_TASKS_TASK_VIEW)).toBe('全部')
    expect(
      getTaskViewLabel(createCategoryTaskView(1), {
        category: createCategory({ name: '全部', is_system: true })
      })
    ).toBe('暂存区')
  })
})
