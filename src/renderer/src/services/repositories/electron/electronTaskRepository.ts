import {
  parseArchivedTaskGroups,
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
    async getArchivedTaskGroups() {
      return parseArchivedTaskGroups(
        await api.db.getArchivedTaskGroups(),
        'db:get-archived-task-groups.response'
      )
    },
    async searchTasks(input) {
      return parseTasks(await api.db.searchTasks(input), 'db:search-tasks.response')
    },
    async createTask(input) {
      return parseTask(await api.db.createTask(input), 'db:create-task.response')
    },
    async updateTask(id, updates) {
      await api.db.updateTask(id, updates)
    },
    async deleteTask(id) {
      await api.db.deleteTask(id)
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
    async archiveCompletedTasks(categoryId) {
      return await api.db.archiveCompletedTasks(categoryId)
    },
    async archiveTask(id) {
      await api.db.archiveTask(id)
    },
    async restoreArchivedTasks(ids) {
      return await api.db.restoreArchivedTasks(ids)
    },
    async reorderTasks(orderedIds) {
      await api.db.reorderTasks(orderedIds)
    },
    async reorderSubTasks(orderedIds) {
      await api.db.reorderSubTasks(orderedIds)
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
