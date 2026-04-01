import {
  parsePendingTaskCounts,
  parseTask,
  parseTasks
} from '../../../../../shared/contracts/entities'
import type { TaskRepository } from '../taskRepository'

export function createElectronTaskRepository(api: Window['api']): TaskRepository {
  return {
    async getTasks(categoryId) {
      return parseTasks(await api.db.getTasks(categoryId), 'db:get-tasks.response')
    },
    async createTask(content, categoryId) {
      return parseTask(await api.db.createTask(content, categoryId), 'db:create-task.response')
    },
    async updateTask(id, updates) {
      await api.db.updateTask(id, updates)
    },
    async deleteTask(id) {
      await api.db.deleteTask(id)
    },
    async deleteTasks(ids) {
      await api.db.deleteTasks(ids)
    },
    async setTaskCompleted(id, completed) {
      await api.db.setTaskCompleted(id, completed)
    },
    async getPendingTaskCounts() {
      return parsePendingTaskCounts(
        await api.db.getPendingTaskCounts(),
        'db:get-pending-counts.response'
      )
    },
    async clearCompletedTasks(categoryId) {
      return await api.db.clearCompletedTasks(categoryId)
    },
    async reorderTasks(orderedIds) {
      await api.db.reorderTasks(orderedIds)
    },
    async getSubTasks(parentId) {
      return parseTasks(await api.db.getSubTasks(parentId), 'db:get-subtasks.response')
    },
    async createSubTask(content, parentId) {
      return parseTask(await api.db.createSubTask(content, parentId), 'db:create-subtask.response')
    },
    async batchCompleteSubTasks(parentId) {
      return await api.db.batchCompleteSubTasks(parentId)
    }
  }
}
