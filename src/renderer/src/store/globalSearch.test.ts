import { describe, expect, it, vi } from 'vitest'
import { useAppSessionStore } from './appSession'
import { useGlobalSearchStore } from './globalSearch'
import { createCategoryTaskView } from '../utils/taskNavigation'
import { createTask, createTaskRepository, installTestRuntime } from '../test/factories'

describe('global search store 自动化主链', () => {
  it('搜索请求会按当前分类作用域传递 categoryId', async () => {
    const taskRepository = createTaskRepository({
      searchTasks: vi.fn().mockResolvedValue([createTask({ id: 3, content: '搜索命中' })])
    })
    installTestRuntime({ taskRepository })
    useAppSessionStore().setSelectedTaskView(createCategoryTaskView(9))

    const store = useGlobalSearchStore()
    store.open('current')
    const results = await store.search({ query: '搜索', categoryId: 9 })

    expect(taskRepository.searchTasks).toHaveBeenCalledWith({
      query: '搜索',
      categoryId: 9,
      limit: 24
    })
    expect(results.map((task) => task.id)).toEqual([3])
    expect(store.selectedTask?.id).toBe(3)
  })

  it('搜索跳转状态可以标记、清理并短暂高亮目标任务', () => {
    vi.useFakeTimers()
    installTestRuntime()

    const store = useGlobalSearchStore()
    store.markTaskForReveal(8)
    store.highlightTask(8)

    expect(store.pendingRevealTaskId).toBe(8)
    expect(store.activeHighlightTaskId).toBe(8)

    store.clearPendingReveal(7)
    expect(store.pendingRevealTaskId).toBe(8)

    store.clearPendingReveal(8)
    vi.advanceTimersByTime(1800)

    expect(store.pendingRevealTaskId).toBeNull()
    expect(store.activeHighlightTaskId).toBeNull()
  })
})

