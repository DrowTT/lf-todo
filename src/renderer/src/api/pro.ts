// Pro 会员相关 API 封装
import request from './request'

// ─── 响应类型定义 ───

interface ProStatus {
  isPro: boolean
  proExpireAt: string | null
}

// ─── API 函数 ───

/**
 * 查询 Pro 状态
 */
export function getProStatus() {
  return request.get<ProStatus>('/pro/status')
}

export type { ProStatus }
