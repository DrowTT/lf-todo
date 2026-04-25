import { describe, expect, it, vi } from 'vitest'
import { useTaskStore } from './task'
import { createTask, createTaskRepository, installTestRuntime } from '../test/factories'

describe('task store 自动化主链', () => {
  it('创建任务后插入列表头部并更新未完成计数', async () => {
    const createdTask = createTask({ id: 2, content: '补测试基线', category_id: 1 })
    const taskRepository = createTaskRepository({
      createTask: vi.fn().mockResolvedValue(createdTask)
    })
    installTestRuntime({ taskRepository })

    const store = useTaskStore()
    store.tasks = [createTask({ id: 1, content: '旧任务', category_id: 1 })]
    store.pendingCounts = { 1: 1 }

    const result = await store.addTask('补测试基线', 1)

    expect(result).toBe(true)
    expect(taskRepository.createTask).toHaveBeenCalledWith({
      content: '补测试基线',
      categoryId: 1,
      due_at: null,
      due_precision: null,
      priority: 'medium'
    })
    expect(store.tasks.map((task) => task.id)).toEqual([2, 1])
    expect(store.pendingCounts[1]).toBe(2)
  })

  it('更新任务内容失败时回滚本地状态', async () => {
    const taskRepository = createTaskRepository({
      updateTask: vi.fn().mockRejectedValue(new Error('保存失败'))
    })
    installTestRuntime({ taskRepository })

    const store = useTaskStore()
    store.tasks = [createTask({ id: 1, content: '原内容' })]

    const result = await store.updateTaskContent(1, '新内容')

    expect(result).toBe(false)
    expect(store.tasks[0].content).toBe('原内容')
  })

  it('全部系统视图查询走 getAllTasks 并不改写分类未完成计数', async () => {
    const allTasks = [createTask({ id: 1, category_id: 1 }), createTask({ id: 2, category_id: 2 })]
    const taskRepository = createTaskRepository({
      getAllTasks: vi.fn().mockResolvedValue(allTasks)
    })
    installTestRuntime({ taskRepository })

    const store = useTaskStore()
    store.pendingCounts = { 1: 5 }

    await store.fetchAllTasks()

    expect(taskRepository.getAllTasks).toHaveBeenCalledOnce()
    expect(store.tasks).toEqual(allTasks)
    expect(store.pendingCounts).toEqual({ 1: 5 })
  })

  it('归档单个任务后从当前列表移除并返回恢复快照', async () => {
    const taskRepository = createTaskRepository({
      archiveTask: vi.fn().mockResolvedValue(undefined)
    })
    installTestRuntime({ taskRepository })

    const store = useTaskStore()
    store.tasks = [createTask({ id: 1, category_id: 7 }), createTask({ id: 2, category_id: 7 })]

    const result = await store.archiveTask(1)

    expect(result).toEqual({ categoryId: 7, taskId: 1 })
    expect(taskRepository.archiveTask).toHaveBeenCalledWith(1)
    expect(store.tasks.map((task) => task.id)).toEqual([2])
  })

  it('系统视图批量归档时只提交当前列表中的已完成根任务', async () => {
    const taskRepository = createTaskRepository({
      archiveCompletedTaskIds: vi.fn().mockResolvedValue(2)
    })
    installTestRuntime({ taskRepository })

    const store = useTaskStore()
    store.tasks = [
      createTask({ id: 1, is_completed: true, parent_id: null }),
      createTask({ id: 2, is_completed: true, parent_id: null }),
      createTask({ id: 3, is_completed: true, parent_id: 1 }),
      createTask({ id: 4, is_completed: false, parent_id: null })
    ]

    const result = await store.archiveAllCompletedTasks()

    expect(result).toEqual({ taskIds: [1, 2] })
    expect(taskRepository.archiveCompletedTaskIds).toHaveBeenCalledWith([1, 2])
    expect(taskRepository.archiveAllCompletedTasks).not.toHaveBeenCalled()
    expect(store.tasks.map((task) => task.id)).toEqual([3, 4])
  })
})
