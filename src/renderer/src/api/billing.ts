import request from './request'

export interface BillingOrder {
  orderNo: string
  productCode: string
  status: 'PENDING' | 'PAID' | 'CLOSED' | 'EXPIRED' | 'FAILED'
  provider: 'WECHAT_NATIVE'
  amountFen: number
  amountYuan: string
  currency: string
  description: string
  codeUrl: string | null
  expiresAt: string | null
  paidAt: string | null
  createdAt: string
  simulateEnabled: boolean
  paymentMode: string
  merchantReady: boolean
}

export function createProLifetimeOrder() {
  return request.post<BillingOrder>('/billing/orders/pro-lifetime')
}

export function getBillingOrder(orderNo: string) {
  return request.get<BillingOrder>(`/billing/orders/${orderNo}`)
}

export function simulateBillingOrderPaid(orderNo: string) {
  return request.post<BillingOrder>(`/billing/orders/${orderNo}/simulate-paid`)
}
