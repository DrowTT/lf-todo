// Auth 相关 IPC 处理器 — Token 安全存储和设备 ID 管理
import { ipcMain, safeStorage } from 'electron'
import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { platform, hostname } from 'os'

// 认证数据存储（独立于设置 store）
interface AuthStoreType {
  // 加密的 Token（Base64 编码后的 Buffer）
  encryptedAccessToken: string
  encryptedRefreshToken: string
  // 设备唯一标识（首次生成后持久化）
  deviceId: string
  // 设备名称
  deviceName: string
}

// 延迟初始化，避免在 app ready 之前创建 Store 实例
let authStore: Store<AuthStoreType> | null = null

function getStore(): Store<AuthStoreType> {
  if (!authStore) {
    authStore = new Store<AuthStoreType>({
      name: 'auth',
      encryptionKey: 'lf-todo-auth-v2'
    })
  }
  return authStore
}

/**
 * 获取或创建设备唯一标识
 */
function getDeviceId(): string {
  const store = getStore()
  let deviceId = store.get('deviceId')
  if (!deviceId) {
    deviceId = randomUUID()
    store.set('deviceId', deviceId)
  }
  return deviceId
}

/**
 * 获取设备名称（操作系统 + 主机名）
 */
function getDeviceName(): string {
  const store = getStore()
  let deviceName = store.get('deviceName')
  if (!deviceName) {
    deviceName = `${platform()}-${hostname()}`
    store.set('deviceName', deviceName)
  }
  return deviceName
}

/**
 * 安全存储 Token（使用 Electron safeStorage 加密）
 */
function encryptToken(token: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token)
    return encrypted.toString('base64')
  }
  // 降级方案：直接存储（开发环境或系统不支持加密时）
  return token
}

/**
 * 解密 Token
 */
function decryptToken(encrypted: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encrypted, 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      return ''
    }
  }
  return encrypted
}

/**
 * 注册所有 Auth 相关的 IPC 处理器
 */
export function registerAuthIpcHandlers(): void {
  // 保存 Token
  ipcMain.handle(
    'auth:save-tokens',
    (_, tokens: { accessToken: string; refreshToken: string }) => {
      const store = getStore()
      store.set('encryptedAccessToken', encryptToken(tokens.accessToken))
      store.set('encryptedRefreshToken', encryptToken(tokens.refreshToken))
      return true
    }
  )

  // 获取 Token
  ipcMain.handle('auth:get-tokens', () => {
    const store = getStore()
    const encAccessToken = store.get('encryptedAccessToken', '')
    const encRefreshToken = store.get('encryptedRefreshToken', '')

    if (!encAccessToken || !encRefreshToken) {
      return null
    }

    return {
      accessToken: decryptToken(encAccessToken),
      refreshToken: decryptToken(encRefreshToken)
    }
  })

  // 清除 Token（登出时调用）
  ipcMain.handle('auth:clear-tokens', () => {
    const store = getStore()
    store.delete('encryptedAccessToken')
    store.delete('encryptedRefreshToken')
    return true
  })

  // 获取设备信息
  ipcMain.handle('auth:get-device-info', () => {
    return {
      deviceId: getDeviceId(),
      deviceName: getDeviceName()
    }
  })
}
