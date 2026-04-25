import { describe, expect, it } from 'vitest'
import { createTask } from '../test/factories'
import { filterTasksForSystemView } from './systemTaskViews'

const NOW = new Date(2026, 3, 24, 10, 0, 0).getTime()
const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

describe('systemTaskViews 智能视图过滤', () => {
  const tasks = [
    createTask({ id: 1, content: '今天任务', due_at: toSeconds(new Date(2026, 3, 24, 18)), due_precision: 'datetime' }),
    createTask({ id: 2, content: '明天任务', due_at: toSeconds(new Date(2026, 3, 25)), due_precision: 'date' }),
    createTask({ id: 3, content: '高优先级', priority: 'high' }),
    createTask({ id: 4, content: '已完成', is_completed: true, due_at: toSeconds(new Date(2026, 3, 24)), due_precision: 'date' }),
    createTask({ id: 5, content: '最近任务', created_at: 999 }),
    createTask({ id: 6, content: '子任务不进入系统视图', parent_id: 1, created_at: 1000 })
  ]

  it('今天视图只包含今天到期且未完成的根任务', () => {
    expect(filterTasksForSystemView(tasks, 'today', NOW).map((task) => task.id)).toEqual([1])
  })

  it('即将到期视图包含未来 7 天内未完成根任务并按到期时间排序', () => {
    expect(filterTasksForSystemView(tasks, 'upcoming', NOW).map((task) => task.id)).toEqual([1, 2])
  })

  it('全部未完成和高优先级视图排除已完成任务', () => {
    expect(filterTasksForSystemView(tasks, 'open', NOW).map((task) => task.id)).toEqual([1, 2, 3, 5])
    expect(filterTasksForSystemView(tasks, 'highPriority', NOW).map((task) => task.id)).toEqual([3])
  })

  it('最近创建视图按创建时间倒序排列根任务', () => {
    expect(filterTasksForSystemView(tasks, 'recent', NOW).map((task) => task.id)).toEqual([
      5, 4, 3, 2, 1
    ])
  })
})
