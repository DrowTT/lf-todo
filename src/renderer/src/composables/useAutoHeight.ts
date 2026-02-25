import { type Ref } from 'vue'

/**
 * 自适应 textarea 高度 composable
 * 根据内容自动调整 textarea 的高度，避免出现竖向滚动条
 *
 * @param elRef - 目标元素的模板引用（textarea 或普通 input 均可）
 * @returns adjustHeight - 可直接绑定到 @input 事件或手动调用
 * @returns resetHeight - 将高度重置为 auto（提交后调用，优化 #11）
 */
export function useAutoHeight(elRef: Ref<HTMLElement | null>) {
  const adjustHeight = () => {
    const el = elRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  /** 重置高度为 auto，由调用方在 nextTick 中执行（优化 #11） */
  const resetHeight = () => {
    if (elRef.value) elRef.value.style.height = 'auto'
  }

  return { adjustHeight, resetHeight }
}
