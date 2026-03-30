// Auth Store — 管理登录状态、用户信息、Token
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '../api/auth'
import type { UserProfile } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  // ─── 状态 ───
  const isLoggedIn = ref(false)
  const isChecking = ref(true) // 启动时检查 Token 是否有效
  const user = ref<UserProfile | null>(null)

  // ─── 计算属性 ───
  const nickname = computed(() => user.value?.nickname ?? '')
  const email = computed(() => user.value?.email ?? '')
  const isPro = computed(() => user.value?.isPro ?? false)

  // ─── Actions ───

  /**
   * 启动时检查认证状态
   * - 有存储的 Token → 请求用户信息 → 成功则自动登录
   * - Token 失效 → 清除本地存储 → 显示登录页
   */
  async function checkAuth(): Promise<boolean> {
    isChecking.value = true
    try {
      const tokens = await window.api.auth.getTokens()
      if (!tokens?.accessToken) {
        isLoggedIn.value = false
        return false
      }

      // 尝试获取用户信息（会自动触发 Token 刷新）
      const res = await authApi.getUserProfile()
      user.value = res.data
      isLoggedIn.value = true
      return true
    } catch {
      // Token 无效或网络错误
      await window.api.auth.clearTokens()
      isLoggedIn.value = false
      user.value = null
      return false
    } finally {
      isChecking.value = false
    }
  }

  /**
   * 登录
   */
  async function login(email: string, password: string): Promise<void> {
    const deviceInfo = await window.api.auth.getDeviceInfo()
    const res = await authApi.login({
      email,
      password,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName
    })

    // 保存 Token
    await window.api.auth.saveTokens({
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken
    })

    // 获取用户信息
    const profileRes = await authApi.getUserProfile()
    user.value = profileRes.data
    isLoggedIn.value = true
  }

  /**
   * 注册
   */
  async function register(
    emailVal: string,
    password: string,
    nicknameVal: string,
    code: string
  ): Promise<void> {
    const deviceInfo = await window.api.auth.getDeviceInfo()
    const res = await authApi.register({
      email: emailVal,
      password,
      nickname: nicknameVal,
      code,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName
    })

    // 保存 Token
    await window.api.auth.saveTokens({
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken
    })

    // 获取用户信息
    const profileRes = await authApi.getUserProfile()
    user.value = profileRes.data
    isLoggedIn.value = true
  }

  /**
   * 登出
   */
  async function logout(): Promise<void> {
    try {
      const deviceInfo = await window.api.auth.getDeviceInfo()
      await authApi.logout(deviceInfo.deviceId)
    } catch {
      // 即使后端登出失败也继续清理本地状态
    }
    await window.api.auth.clearTokens()
    user.value = null
    isLoggedIn.value = false
  }

  /**
   * 强制登出（被踢出时调用）
   */
  async function forceLogout(): Promise<void> {
    await window.api.auth.clearTokens()
    user.value = null
    isLoggedIn.value = false
  }

  return {
    // 状态
    isLoggedIn,
    isChecking,
    user,
    // 计算属性
    nickname,
    email,
    isPro,
    // Actions
    checkAuth,
    login,
    register,
    logout,
    forceLogout
  }
})
