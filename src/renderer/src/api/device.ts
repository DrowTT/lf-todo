// 设备管理相关 API 封装
import request from './request'

// ─── 响应类型定义 ───

interface DeviceSession {
  id: number
  deviceId: string
  deviceName: string | null
  lastActive: string
  createdAt: string
}

// ─── API 函数 ───

/**
 * 获取当前在线设备列表
 */
export function getSessions() {
  return request.get<{ sessions: DeviceSession[] }>('/device/sessions')
}

/**
 * 主动下线某设备
 */
export function removeSession(sessionId: number) {
  return request.delete<{ message: string }>(`/device/sessions/${sessionId}`)
}

export type { DeviceSession }
