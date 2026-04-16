import type { App, InjectionKey } from 'vue'
import { inject } from 'vue'
import { useConfirm } from '../composables/useConfirm'
import { useToast } from '../composables/useToast'
import { createElectronCategoryRepository } from '../services/repositories/electron/electronCategoryRepository'
import {
  createElectronSettingsRepository,
  createElectronUpdaterService,
  createElectronWindowService
} from '../services/repositories/electron/electronSettingsRepository'
import { createElectronTaskRepository } from '../services/repositories/electron/electronTaskRepository'
import type { CategoryRepository } from '../services/repositories/categoryRepository'
import type {
  SettingsRepository,
  UpdaterService,
  WindowService
} from '../services/repositories/settingsRepository'
import type { SearchTasksInput, TaskRepository } from '../services/repositories/taskRepository'
import type { Category, Task, TaskCreateInput, TaskUpdate } from '../../../shared/types/models'

export interface AppRuntime {
  repositories: {
    category: CategoryRepository
    task: TaskRepository
    settings: SettingsRepository
  }
  toast: ReturnType<typeof useToast>
  confirm: ReturnType<typeof useConfirm>
  updater: UpdaterService
  window: WindowService
}

const appRuntimeKey: InjectionKey<AppRuntime> = Symbol('app-runtime')

let activeRuntime: AppRuntime | null = null

function createUnavailableError(capability: string): Error {
  return new Error(`${capability} is unavailable because AppRuntime was created without window.api`)
}

function createUnavailableAction<TArgs extends unknown[], TResult>(
  capability: string
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    void args
    throw createUnavailableError(capability)
  }
}

function createUnavailableCategoryRepository(): CategoryRepository {
  return {
    getCategories: createUnavailableAction<[], Category[]>('categoryRepository.getCategories'),
    createCategory: createUnavailableAction<[string], Category>(
      'categoryRepository.createCategory'
    ),
    updateCategory: createUnavailableAction<[number, string], void>(
      'categoryRepository.updateCategory'
    ),
    deleteCategory: createUnavailableAction<[number], void>('categoryRepository.deleteCategory')
  }
}

function createUnavailableTaskRepository(): TaskRepository {
  return {
    getTasks: createUnavailableAction<[number], Task[]>('taskRepository.getTasks'),
    searchTasks: createUnavailableAction<[SearchTasksInput], Task[]>('taskRepository.searchTasks'),
    createTask: createUnavailableAction<[TaskCreateInput], Task>('taskRepository.createTask'),
    updateTask: createUnavailableAction<[number, TaskUpdate], void>('taskRepository.updateTask'),
    deleteTask: createUnavailableAction<[number], void>('taskRepository.deleteTask'),
    deleteTasks: createUnavailableAction<[number[]], void>('taskRepository.deleteTasks'),
    setTaskCompleted: createUnavailableAction<[number, boolean], void>(
      'taskRepository.setTaskCompleted'
    ),
    getPendingTaskCounts: createUnavailableAction<[], Record<number, number>>(
      'taskRepository.getPendingTaskCounts'
    ),
    clearCompletedTasks: createUnavailableAction<[number], number>(
      'taskRepository.clearCompletedTasks'
    ),
    reorderTasks: createUnavailableAction<[number[]], void>('taskRepository.reorderTasks'),
    reorderSubTasks: createUnavailableAction<[number[]], void>('taskRepository.reorderSubTasks'),
    getSubTasks: createUnavailableAction<[number], Task[]>('taskRepository.getSubTasks'),
    createSubTask: createUnavailableAction<[string, number], Task>('taskRepository.createSubTask'),
    batchCompleteSubTasks: createUnavailableAction<[number], number>(
      'taskRepository.batchCompleteSubTasks'
    )
  }
}

export function createAppRuntime(api?: Window['api']): AppRuntime {
  return {
    repositories: {
      category: api ? createElectronCategoryRepository(api) : createUnavailableCategoryRepository(),
      task: api ? createElectronTaskRepository(api) : createUnavailableTaskRepository(),
      settings: createElectronSettingsRepository(api)
    },
    toast: useToast(),
    confirm: useConfirm(),
    updater: createElectronUpdaterService(api),
    window: createElectronWindowService(api)
  }
}

export function installAppRuntime(app: App, runtime: AppRuntime): void {
  activeRuntime = runtime
  app.provide(appRuntimeKey, runtime)
}

export function useAppRuntime(): AppRuntime {
  const runtime = inject(appRuntimeKey, activeRuntime)

  if (!runtime) {
    throw new Error('App runtime has not been installed')
  }

  return runtime
}
