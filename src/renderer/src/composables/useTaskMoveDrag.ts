import { computed, ref } from 'vue'
import type { Task } from '../../../shared/types/models'

const dragTaskId = ref<number | null>(null)
const dragSourceCategoryId = ref<number | null>(null)
const hoverCategoryId = ref<number | null>(null)
const dropHandled = ref(false)
const dropCategoryId = ref<number | null>(null)

export function useTaskMoveDrag() {
  const isDraggingTask = computed(() => dragTaskId.value !== null)

  function startTaskMoveDrag(task: Pick<Task, 'id' | 'category_id'>) {
    dragTaskId.value = task.id
    dragSourceCategoryId.value = task.category_id
    hoverCategoryId.value = null
    dropHandled.value = false
    dropCategoryId.value = null
  }

  function setHoverCategory(categoryId: number | null) {
    hoverCategoryId.value = categoryId
  }

  function markDropHandled(categoryId: number | null = null) {
    dropHandled.value = true
    dropCategoryId.value = categoryId
  }

  function clearTaskMoveDrag() {
    dragTaskId.value = null
    dragSourceCategoryId.value = null
    hoverCategoryId.value = null
    dropHandled.value = false
    dropCategoryId.value = null
  }

  return {
    dragTaskId,
    dragSourceCategoryId,
    hoverCategoryId,
    dropHandled,
    dropCategoryId,
    isDraggingTask,
    startTaskMoveDrag,
    setHoverCategory,
    markDropHandled,
    clearTaskMoveDrag
  }
}
