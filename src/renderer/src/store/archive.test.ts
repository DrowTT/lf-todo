import { describe, expect, it, vi } from 'vitest'
import { useArchiveStore } from './archive'
import { createArchivedGroup, createTaskRepository, installTestRuntime } from '../test/factories'

describe('archive store 自动化主链', () => {
  it('恢复归档任务后从归档列表与选择集中移除', async () => {
    const taskRepository = createTaskRepository({
      restoreArchivedTasks: vi.fn().mockResolvedValue(2)
    })
    installTestRuntime({ taskRepository })

    const store = useArchiveStore()
    store.setGroups([
      createArchivedGroup({ task: createArchivedGroup().task }),
      createArchivedGroup({ task: createArchivedGroup({ task: { ...createArchivedGroup().task, id: 11 } }).task })
    ])
    store.toggleSelected(10, true)
    store.toggleSelected(11, true)

    const restoredCount = await store.restoreTasks([10, 11])

    expect(restoredCount).toBe(2)
    expect(taskRepository.restoreArchivedTasks).toHaveBeenCalledWith([10, 11])
    expect(store.groups).toEqual([])
    expect(store.selectedIds).toEqual([])
  })
})
