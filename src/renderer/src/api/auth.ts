// 认证相关 API 封装
import request from './request'

// ─── 请求/响应类型定义 ───

interface AuthTokens {
  accessToken: string
  refreshToken: string
  kickedDeviceId?: string
}

interface SendCodeResponse {
  message: string
  deliveryMode: 'email' | 'console'
  devCode?: string
}

interface UserProfile {
  id: number
  email: string
  nickname: string
  isPro: boolean
  proExpireAt: string | null
  createdAt: string
  level: {
    totalXp: number
    currentLevel: number
  }
}

// ─── API 函数 ───

/**
 * 发送验证码
 */
export function sendCode(email: string, type: 'register' | 'reset_password') {
  return request.post<SendCodeResponse>('/auth/send-code', { email, type })
}

/**
 * 注册
 */
export function register(data: {
  email: string
  password: string
  nickname: string
  code: string
  deviceId: string
  deviceName: string
}) {
  return request.post<AuthTokens>('/auth/register', data)
}

/**
 * 登录
 */
export function login(data: {
  email: string
  password: string
  deviceId: string
  deviceName: string
}) {
  return request.post<AuthTokens>('/auth/login', data)
}

/**
 * 登出
 */
export function logout(deviceId: string) {
  return request.post<{ message: string }>('/auth/logout', { deviceId })
}

/**
 * 重置密码
 */
export function resetPassword(data: {
  email: string
  code: string
  newPassword: string
}) {
  return request.post<{ message: string }>('/auth/reset-password', data)
}

/**
 * 获取用户信息
 */
export function getUserProfile() {
  return request.get<UserProfile>('/user/profile')
}

export type { AuthTokens, SendCodeResponse, UserProfile }
