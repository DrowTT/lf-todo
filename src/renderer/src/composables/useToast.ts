import { ref } from 'vue'

export interface ToastMessage {
  text: string
  type: 'error' | 'info' | 'success'
  actionLabel?: string
  onAction?: () => void
  duration?: number
}

const message = ref<ToastMessage | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function show(
    text: string,
    type: ToastMessage['type'] = 'error',
    options: Pick<ToastMessage, 'actionLabel' | 'onAction' | 'duration'> = {}
  ) {
    if (timer) clearTimeout(timer)

    const duration = options.duration ?? 3000
    message.value = { text, type, ...options, duration }

    timer = setTimeout(() => {
      message.value = null
      timer = null
    }, duration)
  }

  function hide() {
    if (timer) clearTimeout(timer)
    message.value = null
    timer = null
  }

  function triggerAction() {
    const action = message.value?.onAction
    hide()
    action?.()
  }

  return { message, show, hide, triggerAction }
}
