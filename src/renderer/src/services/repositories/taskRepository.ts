import type { Task, TaskCreateInput, TaskUpdate } from '../../../../shared/types/models'

export interface SearchTasksInput {
  query: string
  categoryId?: number | null
  limit?: number
}

export interface TaskRepository {
  getTasks(categoryId: number): Promise<Task[]>
  searchTasks?(input: SearchTasksInput): Promise<Task[]>
  createTask(input: TaskCreateInput): Promise<Task>
  updateTask(id: number, updates: TaskUpdate): Promise<void>
  deleteTask(id: number): Promise<void>
  deleteTasks(ids: number[]): Promise<void>
  setTaskCompleted(id: number, completed: boolean): Promise<void>
  getPendingTaskCounts(): Promise<Record<number, number>>
  clearCompletedTasks(categoryId: number): Promise<number>
  reorderTasks(orderedIds: number[]): Promise<void>
  reorderSubTasks(orderedIds: number[]): Promise<void>
  getSubTasks(parentId: number): Promise<Task[]>
  createSubTask(content: string, parentId: number): Promise<Task>
  batchCompleteSubTasks(parentId: number): Promise<number>
}
