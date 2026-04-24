import { vi } from 'vitest'
import type { App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { installAppRuntime, type AppRuntime } from '../app/runtime'
import type {
  ArchivedTaskGroup,
  Category,
  Task,
  TaskPriority
} from '../../../shared/types/models'
import type { CategoryRepository } from '../services/repositories/categoryRepository'
import type { TaskRepository } from '../services/repositories/taskRepository'
import type {
  SettingsRepository,
  UpdaterService,
  WindowService
} from '../services/repositories/settingsRepository'

export function createCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: '暂存区',
    is_system: true,
    order_index: 0,
    created_at: 1,
    ...overrides
  }
}

export function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    content: '整理路线图',
    description: null,
    is_completed: false,
    category_id: 1,
    order_index: 0,
    created_at: 1,
    completed_at: null,
    last_restored_at: null,
    parent_id: null,
    due_at: null,
    due_precision: null,
    priority: 'medium' as TaskPriority,
    archived_at: null,
    archived_category_name: null,
    subtask_total: 0,
    subtask_done: 0,
    ...overrides
  }
}

export function createArchivedGroup(overrides: Partial<ArchivedTaskGroup> = {}): ArchivedTaskGroup {
  return {
    task: createTask({ id: 10, content: '已归档任务', archived_at: 100 }),
    subTasks: [],
    ...overrides
  }
}

export function createTaskRepository(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    getTasks: vi.fn().mockResolvedValue([]),
    getAllTasks: vi.fn().mockResolvedValue([]),
    getArchivedTaskGroups: vi.fn().mockResolvedValue([]),
    searchTasks: vi.fn().mockResolvedValue([]),
    createTask: vi.fn().mockImplementation(async (input) =>
      createTask({
        id: 100,
        content: input.content,
        category_id: input.categoryId,
        due_at: input.due_at,
        due_precision: input.due_precision,
        priority: input.priority
      })
    ),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTaskToCategory: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    setTaskCompleted: vi.fn().mockResolvedValue(undefined),
    getPendingTaskCounts: vi.fn().mockResolvedValue({}),
    archiveCompletedTasks: vi.fn().mockResolvedValue(0),
    archiveAllCompletedTasks: vi.fn().mockResolvedValue(0),
    archiveTask: vi.fn().mockResolvedValue(undefined),
    restoreArchivedTasks: vi.fn().mockResolvedValue(0),
    reorderTasks: vi.fn().mockResolvedValue(undefined),
    reorderSubTasks: vi.fn().mockResolvedValue(undefined),
    getSubTasks: vi.fn().mockResolvedValue([]),
    createSubTask: vi.fn().mockImplementation(async (content, parentId) =>
      createTask({ id: 200, content, parent_id: parentId })
    ),
    batchCompleteSubTasks: vi.fn().mockResolvedValue(0),
    ...overrides
  }
}

export function createCategoryRepository(
  overrides: Partial<CategoryRepository> = {}
): CategoryRepository {
  return {
    getCategories: vi.fn().mockResolvedValue([]),
    createCategory: vi.fn().mockImplementation(async (name) => createCategory({ id: 2, name })),
    updateCategory: vi.fn().mockResolvedValue(undefined),
    deleteCategory: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

export function installTestRuntime(options: {
  taskRepository?: TaskRepository
  categoryRepository?: CategoryRepository
} = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const taskRepository = options.taskRepository ?? createTaskRepository()
  const categoryRepository = options.categoryRepository ?? createCategoryRepository()
  const runtime: AppRuntime = {
    repositories: {
      task: taskRepository,
      category: categoryRepository,
      settings: createSettingsRepository()
    },
    toast: { message: null, show: vi.fn(), hide: vi.fn(), triggerAction: vi.fn() } as unknown as AppRuntime['toast'],
    confirm: {
      current: null,
      confirm: vi.fn(),
      handleConfirm: vi.fn(),
      handleCancel: vi.fn()
    } as unknown as AppRuntime['confirm'],
    updater: createUpdaterService(),
    window: createWindowService()
  }

  installAppRuntime({ provide: vi.fn() } as unknown as App, runtime)

  return { pinia, runtime, taskRepository, categoryRepository }
}

function createSettingsRepository(): SettingsRepository {
  return {
    isAvailable: true,
    getAll: vi.fn(),
    setAutoLaunch: vi.fn(),
    setCloseToTray: vi.fn(),
    setAutoCleanup: vi.fn(),
    setPomodoroFocusDuration: vi.fn(),
    setPomodoroActiveSession: vi.fn(),
    completePomodoroSession: vi.fn(),
    notifyPomodoroCompleted: vi.fn(),
    importData: vi.fn(),
    mergeData: vi.fn(),
    exportData: vi.fn(),
    getAppInfo: vi.fn()
  }
}

function createUpdaterService(): UpdaterService {
  return {
    isAvailable: true,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    onUpdateStatus: vi.fn()
  }
}

function createWindowService(): WindowService {
  return {
    isAvailable: true,
    minimize: vi.fn(),
    close: vi.fn(),
    hideToTray: vi.fn(),
    quit: vi.fn(),
    toggleAlwaysOnTop: vi.fn(),
    toggleMaximize: vi.fn(),
    onQuitRequested: vi.fn(),
    onQuickAddCommitted: vi.fn(),
    onAlwaysOnTopChanged: vi.fn(),
    onMaximizedChanged: vi.fn()
  }
}
