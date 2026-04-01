import { parseCategories, parseCategory } from '../../../../../shared/contracts/entities'
import type { CategoryRepository } from '../categoryRepository'

export function createElectronCategoryRepository(api: Window['api']): CategoryRepository {
  return {
    async getCategories() {
      return parseCategories(await api.db.getCategories(), 'db:get-categories.response')
    },
    async createCategory(name) {
      return parseCategory(await api.db.createCategory(name), 'db:create-category.response')
    },
    async updateCategory(id, name) {
      await api.db.updateCategory(id, name)
    },
    async deleteCategory(id) {
      await api.db.deleteCategory(id)
    }
  }
}
