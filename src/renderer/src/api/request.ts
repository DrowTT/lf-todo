// axios 封装 — 统一请求配置、Token 注入、401 自动刷新
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// API 地址：开发环境直连本地后端，生产环境走子域名
const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3001'
  : 'https://todo-api.drowts.cn'

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 是否正在刷新 Token
let isRefreshing = false
// 等待 Token 刷新的请求队列
let refreshSubscribers: Array<(token: string) => void> = []

/**
 * 通知所有排队的请求，Token 已刷新
 */
function onRefreshed(newToken: string): void {
  refreshSubscribers.forEach((cb) => cb(newToken))
  refreshSubscribers = []
}

/**
 * 将请求加入等待队列
 */
function addRefreshSubscriber(cb: (token: string) => void): void {
  refreshSubscribers.push(cb)
}

// ─── 请求拦截器：自动注入 Access Token ───
request.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 不需要 Token 的白名单路由
    const whitelist = ['/auth/login', '/auth/register', '/auth/send-code', '/auth/reset-password', '/auth/refresh']
    const isWhitelisted = whitelist.some((path) => config.url?.includes(path))

    if (!isWhitelisted) {
      const tokens = await window.api.auth.getTokens()
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ─── 响应拦截器：401 自动刷新 Token ───
request.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // 非 401 直接抛出
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // 标记已重试，防止死循环
    originalRequest._retry = true

    // 如果已经在刷新中，把当前请求加入队列等待
    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((newToken: string) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          resolve(request(originalRequest))
        })
      })
    }

    isRefreshing = true

    try {
      const tokens = await window.api.auth.getTokens()
      if (!tokens?.refreshToken) {
        // 没有 Refresh Token，强制登出
        await window.api.auth.clearTokens()
        window.dispatchEvent(new CustomEvent('auth:force-logout'))
        return Promise.reject(error)
      }

      const deviceInfo = await window.api.auth.getDeviceInfo()

      // 调用 refresh 接口
      const response = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken: tokens.refreshToken,
        deviceId: deviceInfo.deviceId
      })

      const { accessToken, refreshToken } = response.data

      // 保存新 Token
      await window.api.auth.saveTokens({ accessToken, refreshToken })

      // 通知所有排队的请求
      onRefreshed(accessToken)

      // 重新发送原始请求
      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return request(originalRequest)
    } catch (refreshError) {
      // Refresh Token 也失效了，强制登出
      await window.api.auth.clearTokens()
      refreshSubscribers = []
      window.dispatchEvent(new CustomEvent('auth:force-logout'))
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default request
export { BASE_URL }
