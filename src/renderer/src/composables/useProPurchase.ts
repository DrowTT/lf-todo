import { computed, onUnmounted, readonly, ref } from 'vue'
import type { BillingOrder } from '../api/billing'
import {
  createProLifetimeOrder,
  getBillingOrder,
  simulateBillingOrderPaid
} from '../api/billing'
import { useToast } from './useToast'

const POLL_INTERVAL_MS = 3000

interface UseProPurchaseOptions {
  onPurchased?: (order: BillingOrder) => void
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object'
  ) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response
    const message = response?.data?.message

    if (typeof message === 'string' && message.trim()) {
      return message
    }

    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0]
    }
  }

  return fallback
}

export function useProPurchase(options: UseProPurchaseOptions = {}) {
  const { show } = useToast()

  const order = ref<BillingOrder | null>(null)
  const isCreating = ref(false)
  const isRefreshing = ref(false)
  const isSimulating = ref(false)
  const errorMessage = ref('')

  let pollTimer: number | null = null

  const statusLabel = computed(() => {
    switch (order.value?.status) {
      case 'PAID':
        return '已支付'
      case 'CLOSED':
        return '已关闭'
      case 'EXPIRED':
        return '已过期'
      case 'FAILED':
        return '支付失败'
      case 'PENDING':
        return '待支付'
      default:
        return '尚未创建订单'
    }
  })

  const paymentModeLabel = computed(() => {
    switch (order.value?.paymentMode) {
      case 'mock':
        return '开发态 Mock 支付'
      default:
        return '微信 Native 支付'
    }
  })

  function clearPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPolling() {
    if (pollTimer || order.value?.status !== 'PENDING') {
      return
    }

    pollTimer = window.setInterval(() => {
      void refreshOrderStatus(true)
    }, POLL_INTERVAL_MS)
  }

  function announcePurchase(nextOrder: BillingOrder) {
    show('Pro 已开通，权限状态已刷新', 'success')
    window.dispatchEvent(new CustomEvent('pro:status-changed'))
    options.onPurchased?.(nextOrder)
  }

  function applyOrder(nextOrder: BillingOrder) {
    const previousStatus = order.value?.status
    order.value = nextOrder

    if (nextOrder.status === 'PENDING') {
      startPolling()
      return
    }

    clearPolling()

    if (nextOrder.status === 'PAID' && previousStatus !== 'PAID') {
      announcePurchase(nextOrder)
      return
    }

    if (
      previousStatus === 'PENDING' &&
      ['CLOSED', 'EXPIRED', 'FAILED'].includes(nextOrder.status)
    ) {
      show(`订单状态已更新为${statusLabel.value}`, nextOrder.status === 'FAILED' ? 'error' : 'info')
    }
  }

  async function createOrder() {
    if (isCreating.value) return

    errorMessage.value = ''
    isCreating.value = true

    try {
      const response = await createProLifetimeOrder()
      applyOrder(response.data)

      if (response.data.status === 'PENDING') {
        show(
          response.data.paymentMode === 'mock'
            ? '开发态订单已创建，可继续模拟支付验证流程'
            : '订单已创建，请使用微信扫码支付',
          'info'
        )
      }
    } catch (error) {
      const message = resolveErrorMessage(error, '创建订单失败，请稍后重试')
      errorMessage.value = message
      show(message, 'error')
    } finally {
      isCreating.value = false
    }
  }

  async function refreshOrderStatus(silent = false) {
    if (!order.value || isRefreshing.value) return

    isRefreshing.value = true

    try {
      const response = await getBillingOrder(order.value.orderNo)
      applyOrder(response.data)
    } catch (error) {
      const message = resolveErrorMessage(error, '刷新订单状态失败')
      errorMessage.value = message

      if (!silent) {
        show(message, 'error')
      }
    } finally {
      isRefreshing.value = false
    }
  }

  async function simulatePaid() {
    if (!order.value || isSimulating.value) return

    isSimulating.value = true

    try {
      const response = await simulateBillingOrderPaid(order.value.orderNo)
      applyOrder(response.data)
    } catch (error) {
      const message = resolveErrorMessage(error, '模拟支付失败')
      errorMessage.value = message
      show(message, 'error')
    } finally {
      isSimulating.value = false
    }
  }

  function reset() {
    clearPolling()
    order.value = null
    errorMessage.value = ''
    isCreating.value = false
    isRefreshing.value = false
    isSimulating.value = false
  }

  onUnmounted(() => {
    clearPolling()
  })

  return {
    order: readonly(order),
    isCreating: readonly(isCreating),
    isRefreshing: readonly(isRefreshing),
    isSimulating: readonly(isSimulating),
    errorMessage: readonly(errorMessage),
    statusLabel,
    paymentModeLabel,
    createOrder,
    refreshOrderStatus,
    simulatePaid,
    reset
  }
}
