import { DEFAULT_TASK_PRIORITY } from '../../../shared/constants/task'
import type { TaskPriority } from '../../../shared/types/models'

export interface TaskPriorityOption {
  value: TaskPriority
  code: 'P1' | 'P2' | 'P3'
  title: string
  hint: string
}

export const TASK_PRIORITY_OPTIONS: TaskPriorityOption[] = [
  {
    value: 'high',
    code: 'P1',
    title: '高优先级',
    hint: '先推进'
  },
  {
    value: 'medium',
    code: 'P2',
    title: '常规优先级',
    hint: '默认节奏'
  },
  {
    value: 'low',
    code: 'P3',
    title: '低优先级',
    hint: '稍后处理'
  }
]

const optionMap = new Map(TASK_PRIORITY_OPTIONS.map((option) => [option.value, option]))
const TASK_PRIORITY_CYCLE_ORDER: TaskPriority[] = ['medium', 'high', 'low']
const priorityCycleIndexMap = new Map(
  TASK_PRIORITY_CYCLE_ORDER.map((priority, index) => [priority, index])
)

export function getTaskPriorityOption(priority: TaskPriority): TaskPriorityOption {
  return optionMap.get(priority) ?? optionMap.get(DEFAULT_TASK_PRIORITY)!
}

export function getTaskPriorityCode(priority: TaskPriority): TaskPriorityOption['code'] {
  return getTaskPriorityOption(priority).code
}

export function getTaskPriorityTitle(priority: TaskPriority): string {
  return getTaskPriorityOption(priority).title
}

export function getNextTaskPriority(priority: TaskPriority): TaskPriority {
  const currentIndex =
    priorityCycleIndexMap.get(priority) ?? priorityCycleIndexMap.get(DEFAULT_TASK_PRIORITY) ?? 0

  return TASK_PRIORITY_CYCLE_ORDER[(currentIndex + 1) % TASK_PRIORITY_CYCLE_ORDER.length]!
}
