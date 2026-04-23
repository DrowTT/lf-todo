import type {
  ArchivedTaskGroup,
  Task,
  TaskCreateInput,
  TaskUpdate
} from '../../../../shared/types/models'

export interface SearchTasksInput {
  query: string
  categoryId?: number | null
  limit?: number
}

export interface TaskRepository {
  getTasks(categoryId: number): Promise<Task[]>
  getAllTasks(): Promise<Task[]>
  getArchivedTaskGroups(): Promise<ArchivedTaskGroup[]>
  searchTasks?(input: SearchTasksInput): Promise<Task[]>
  createTask(input: TaskCreateInput): Promise<Task>
  updateTask(id: number, updates: TaskUpdate): Promise<void>
  moveTaskToCategory(id: number, targetCategoryId: number): Promise<void>
  deleteTask(id: number): Promise<void>
  setTaskCompleted(id: number, completed: boolean): Promise<void>
  getPendingTaskCounts(): Promise<Record<number, number>>
  archiveCompletedTasks(categoryId: number): Promise<number>
  archiveAllCompletedTasks(): Promise<number>
  archiveTask?(id: number): Promise<void>
  restoreArchivedTasks(ids: number[]): Promise<number>
  reorderTasks(orderedIds: number[]): Promise<void>
  reorderSubTasks(orderedIds: number[]): Promise<void>
  getSubTasks(parentId: number): Promise<Task[]>
  createSubTask(content: string, parentId: number): Promise<Task>
  batchCompleteSubTasks(parentId: number): Promise<number>
}
