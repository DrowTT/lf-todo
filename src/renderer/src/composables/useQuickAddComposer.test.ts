import { describe, expect, it, vi } from 'vitest'
import { useQuickAddComposer } from './useQuickAddComposer'
import { createCategory, createTask } from '../test/factories'

describe('useQuickAddComposer 自动化主链', () => {
  it('无分类前缀时提交到默认暂存区', async () => {
    const inbox = createCategory({ id: 1, name: '全部', is_system: true })
    const task = createTask({ id: 9, content: '快速捕获', category_id: 1 })
    vi.stubGlobal('window', {
      api: {
        db: { getCategories: vi.fn().mockResolvedValue([inbox]) },
        quickAdd: {
          submit: vi.fn().mockResolvedValue({ task, category: inbox, categoryCreated: false })
        }
      },
      localStorage
    })

    const composer = useQuickAddComposer()
    await composer.loadCategories()
    composer.draft.value = '快速捕获'

    const result = await composer.submit()

    expect(window.api.quickAdd.submit).toHaveBeenCalledWith({
      content: '快速捕获',
      categoryId: 1,
      categoryName: null
    })
    expect(result?.task.id).toBe(9)
    expect(composer.draft.value).toBe('')
  })

  it('分类前缀可确认为新分类并随提交传递分类名', async () => {
    const inbox = createCategory({ id: 1 })
    const newCategory = createCategory({ id: 2, name: '项目', is_system: false })
    vi.stubGlobal('window', {
      api: {
        db: { getCategories: vi.fn().mockResolvedValue([inbox]) },
        quickAdd: {
          submit: vi.fn().mockResolvedValue({
            task: createTask({ id: 12, category_id: 2 }),
            category: newCategory,
            categoryCreated: true
          })
        }
      },
      localStorage
    })

    const composer = useQuickAddComposer()
    await composer.loadCategories()
    composer.draft.value = '#项目 推进自动化测试'

    const result = await composer.submit()

    expect(window.api.quickAdd.submit).toHaveBeenCalledWith({
      content: '推进自动化测试',
      categoryId: null,
      categoryName: '项目'
    })
    expect(result?.categoryCreated).toBe(true)
    expect(composer.selectedCategory.value?.id).toBe(2)
  })
})
