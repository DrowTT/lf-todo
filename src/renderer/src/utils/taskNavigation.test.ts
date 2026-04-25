import { describe, expect, it } from 'vitest'
import { createCategory } from '../test/factories'
import {
  ALL_TASKS_TASK_VIEW,
  ALL_TASKS_VIEW_DESCRIPTION,
  ARCHIVE_TASK_VIEW,
  ARCHIVE_TASK_VIEW_DESCRIPTION,
  HIGH_PRIORITY_TASKS_TASK_VIEW,
  HISTORY_TASK_VIEW_DEFINITIONS,
  INBOX_CAPTURE_DESCRIPTION,
  INBOX_CAPTURE_LABEL,
  OPEN_TASKS_TASK_VIEW,
  RECENT_TASKS_TASK_VIEW,
  SYSTEM_TASK_VIEW_DEFINITIONS,
  TODAY_TASKS_TASK_VIEW,
  UPCOMING_TASKS_TASK_VIEW,
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
    expect(normalizeTaskView({ kind: 'system', view: 'today' }, createCategoryTaskView(1))).toEqual(
      TODAY_TASKS_TASK_VIEW
    )
    expect(normalizeTaskView({ kind: 'system', view: 'upcoming' }, createCategoryTaskView(1))).toEqual(
      UPCOMING_TASKS_TASK_VIEW
    )
    expect(normalizeTaskView({ kind: 'system', view: 'open' }, createCategoryTaskView(1))).toEqual(
      OPEN_TASKS_TASK_VIEW
    )
    expect(normalizeTaskView({ kind: 'system', view: 'highPriority' }, createCategoryTaskView(1))).toEqual(
      HIGH_PRIORITY_TASKS_TASK_VIEW
    )
    expect(normalizeTaskView({ kind: 'system', view: 'recent' }, createCategoryTaskView(1))).toEqual(
      RECENT_TASKS_TASK_VIEW
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

  it('系统视图、捕获落点和历史区有独立说明', () => {
    expect(SYSTEM_TASK_VIEW_DEFINITIONS.all.description).toBe(ALL_TASKS_VIEW_DESCRIPTION)
    expect(SYSTEM_TASK_VIEW_DEFINITIONS.all.description).toContain('不作为默认捕获落点')
    expect(INBOX_CAPTURE_LABEL).toBe('暂存区')
    expect(INBOX_CAPTURE_DESCRIPTION).toContain('默认捕获落点')
    expect(HISTORY_TASK_VIEW_DEFINITIONS.archive.description).toBe(ARCHIVE_TASK_VIEW_DESCRIPTION)
    expect(HISTORY_TASK_VIEW_DEFINITIONS.archive.description).toContain('历史区')
  })

  it('首批智能视图定义齐全', () => {
    expect(Object.keys(SYSTEM_TASK_VIEW_DEFINITIONS)).toEqual([
      'all',
      'today',
      'upcoming',
      'open',
      'highPriority',
      'recent'
    ])
  })
})
