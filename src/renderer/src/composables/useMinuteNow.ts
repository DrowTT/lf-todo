import { onMounted, onUnmounted, ref } from 'vue'

const TICK_INTERVAL = 30_000

const now = ref(Date.now())
let subscriberCount = 0
let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (timer) {
    return
  }

  timer = setInterval(() => {
    now.value = Date.now()
  }, TICK_INTERVAL)
}

function stopTimer() {
  if (!timer || subscriberCount > 0) {
    return
  }

  clearInterval(timer)
  timer = null
}

export function useMinuteNow() {
  onMounted(() => {
    subscriberCount += 1
    now.value = Date.now()
    startTimer()
  })

  onUnmounted(() => {
    subscriberCount = Math.max(0, subscriberCount - 1)
    stopTimer()
  })

  return now
}
