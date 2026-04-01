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
import type { TaskRepository } from '../services/repositories/taskRepository'
import type { Category, Task, TaskUpdate } from '../../../shared/types/models'

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

function createUnavailableCategoryRepository(): CategoryRepository {
  return {
    async getCategories() {
      throw createUnavailableError('categoryRepository.getCategories')
    },
    async createCategory(_name: string): Promise<Category> {
      throw createUnavailableError('categoryRepository.createCategory')
    },
    async updateCategory(_id: number, _name: string) {
      throw createUnavailableError('categoryRepository.updateCategory')
    },
    async deleteCategory(_id: number) {
      throw createUnavailableError('categoryRepository.deleteCategory')
    }
  }
}

function createUnavailableTaskRepository(): TaskRepository {
  return {
    async getTasks(_categoryId: number): Promise<Task[]> {
      throw createUnavailableError('taskRepository.getTasks')
    },
    async createTask(_content: string, _categoryId: number): Promise<Task> {
      throw createUnavailableError('taskRepository.createTask')
    },
    async updateTask(_id: number, _updates: TaskUpdate) {
      throw createUnavailableError('taskRepository.updateTask')
    },
    async deleteTask(_id: number) {
      throw createUnavailableError('taskRepository.deleteTask')
    },
    async deleteTasks(_ids: number[]) {
      throw createUnavailableError('taskRepository.deleteTasks')
    },
    async setTaskCompleted(_id: number, _completed: boolean) {
      throw createUnavailableError('taskRepository.setTaskCompleted')
    },
    async getPendingTaskCounts(): Promise<Record<number, number>> {
      throw createUnavailableError('taskRepository.getPendingTaskCounts')
    },
    async clearCompletedTasks(_categoryId: number): Promise<number> {
      throw createUnavailableError('taskRepository.clearCompletedTasks')
    },
    async reorderTasks(_orderedIds: number[]) {
      throw createUnavailableError('taskRepository.reorderTasks')
    },
    async getSubTasks(_parentId: number): Promise<Task[]> {
      throw createUnavailableError('taskRepository.getSubTasks')
    },
    async createSubTask(_content: string, _parentId: number): Promise<Task> {
      throw createUnavailableError('taskRepository.createSubTask')
    },
    async batchCompleteSubTasks(_parentId: number): Promise<number> {
      throw createUnavailableError('taskRepository.batchCompleteSubTasks')
    }
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
