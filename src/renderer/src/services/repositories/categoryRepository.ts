import type { Category } from '../../../../shared/types/models'

export interface CategoryRepository {
  getCategories(): Promise<Category[]>
  createCategory(name: string): Promise<Category>
  updateCategory(id: number, name: string): Promise<void>
  deleteCategory(id: number): Promise<void>
}
