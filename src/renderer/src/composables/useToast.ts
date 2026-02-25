import { ref } from 'vue'

export interface ToastMessage {
  text: string
  type: 'error' | 'info' | 'success'
}

// 模块级单例 state：全局同一时刻只有一个 Toast
// （当前规模的单一窗口应用不会出现并发冲突）
const message = ref<ToastMessage | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function show(text: string, type: ToastMessage['type'] = 'error') {
    // 清除上一个未消失的 Toast
    if (timer) clearTimeout(timer)
    message.value = { text, type }
    timer = setTimeout(() => {
      message.value = null
      timer = null
    }, 3000)
  }

  function hide() {
    if (timer) clearTimeout(timer)
    message.value = null
    timer = null
  }

  return { message, show, hide }
}
