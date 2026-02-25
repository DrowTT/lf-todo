import { ref, computed } from 'vue'

/**
 * 队列中的每个确认框条目
 */
interface ConfirmItem {
  message: string
  resolve: (value: boolean) => void
}

/**
 * 模块级队列（单例）
 *
 * 设计说明：
 * - 同一时刻可接受多次 confirm() 调用，每次追加至队列尾部
 * - ConfirmDialog 始终展示队列头部（current）的对话框
 * - 关闭（确认/取消）后自动展示下一条，直到队列清空
 * - 相比原单例 state 方案，彻底消除了并发调用时
 *   第一个 Promise 永远不 resolve 的内存泄漏 + UI 死锁风险
 */
const queue = ref<ConfirmItem[]>([])

/** 当前展示的确认框（computed 派生，只读） */
const current = computed(() => queue.value[0] ?? null)

export function useConfirm() {
  /**
   * 弹出确认框，返回用户选择结果的 Promise
   * 多次调用会排队，逐一展示
   */
  const confirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      queue.value.push({ message, resolve })
    })
  }

  /** 内部：消费队列头部并 resolve */
  const _settle = (result: boolean) => {
    const item = queue.value.shift()
    item?.resolve(result)
  }

  const handleConfirm = () => _settle(true)
  const handleCancel = () => _settle(false)

  return {
    /** 当前展示的确认框状态（null 表示无待处理对话框） */
    current,
    confirm,
    handleConfirm,
    handleCancel
  }
}
