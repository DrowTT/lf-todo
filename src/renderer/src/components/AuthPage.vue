<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { sendCode, resetPassword } from '../api/auth'
import { useAuthStore } from '../store/auth'

type AuthMode = 'login' | 'register' | 'reset'

const authStore = useAuthStore()

const mode = ref<AuthMode>('login')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('')
const code = ref('')

const loading = ref(false)
const error = ref('')
const success = ref('')
const codeCountdown = ref(0)

let countdownTimer: ReturnType<typeof setInterval> | null = null

const title = computed(() => {
  switch (mode.value) {
    case 'login':
      return '登录'
    case 'register':
      return '注册账号'
    case 'reset':
      return '找回密码'
  }
})

function clearCountdown(): void {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function clearForm(): void {
  email.value = ''
  password.value = ''
  confirmPassword.value = ''
  nickname.value = ''
  code.value = ''
  error.value = ''
  success.value = ''
  codeCountdown.value = 0
  clearCountdown()
}

function switchMode(nextMode: AuthMode): void {
  mode.value = nextMode
  clearForm()
}

function startCodeCountdown(): void {
  clearCountdown()
  codeCountdown.value = 60
  countdownTimer = setInterval(() => {
    codeCountdown.value -= 1
    if (codeCountdown.value <= 0) {
      clearCountdown()
    }
  }, 1000)
}

async function handleSendCode(): Promise<void> {
  if (!email.value) {
    error.value = '请输入邮箱'
    return
  }

  try {
    const type = mode.value === 'register' ? 'register' : 'reset_password'
    const response = await sendCode(email.value, type)

    success.value = response.data.devCode
      ? `开发环境验证码：${response.data.devCode}`
      : response.data.message
    error.value = ''
    startCodeCountdown()
  } catch (err: any) {
    error.value = err.response?.data?.message || '发送验证码失败'
  }
}

async function handleLogin(): Promise<void> {
  if (!email.value || !password.value) {
    error.value = '请填写邮箱和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await authStore.login(email.value, password.value)
  } catch (err: any) {
    error.value = err.response?.data?.message || '登录失败'
  } finally {
    loading.value = false
  }
}

async function handleRegister(): Promise<void> {
  if (!email.value || !password.value || !nickname.value || !code.value) {
    error.value = '请填写所有字段'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = '两次密码不一致'
    return
  }

  if (password.value.length < 8) {
    error.value = '密码最少 8 位'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await authStore.register(email.value, password.value, nickname.value, code.value)
  } catch (err: any) {
    error.value = err.response?.data?.message || '注册失败'
  } finally {
    loading.value = false
  }
}

async function handleResetPassword(): Promise<void> {
  if (!email.value || !code.value || !password.value) {
    error.value = '请填写所有字段'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = '两次密码不一致'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await resetPassword({
      email: email.value,
      code: code.value,
      newPassword: password.value,
    })
    success.value = '密码已重置，请登录'
    setTimeout(() => switchMode('login'), 1500)
  } catch (err: any) {
    error.value = err.response?.data?.message || '重置失败'
  } finally {
    loading.value = false
  }
}

function handleSubmit(): void {
  switch (mode.value) {
    case 'login':
      void handleLogin()
      break
    case 'register':
      void handleRegister()
      break
    case 'reset':
      void handleResetPassword()
      break
  }
}

onBeforeUnmount(() => {
  clearCountdown()
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-titlebar" />

    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-logo">✓</div>
        <h1 class="auth-title">极简待办</h1>
        <p class="auth-subtitle">{{ title }}</p>
      </div>

      <div v-if="error" class="auth-message auth-error">{{ error }}</div>
      <div v-if="success" class="auth-message auth-success">{{ success }}</div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>邮箱</label>
          <input
            v-model="email"
            type="email"
            placeholder="请输入邮箱"
            autocomplete="email"
          />
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label>昵称</label>
          <input
            v-model="nickname"
            type="text"
            placeholder="2-16 个字符"
            maxlength="16"
          />
        </div>

        <div v-if="mode !== 'login'" class="form-group">
          <label>验证码</label>
          <div class="code-input">
            <input
              v-model="code"
              type="text"
              placeholder="6 位验证码"
              maxlength="6"
            />
            <button
              type="button"
              class="send-code-btn"
              :disabled="codeCountdown > 0"
              @click="handleSendCode"
            >
              {{ codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码' }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>{{ mode === 'reset' ? '新密码' : '密码' }}</label>
          <input
            v-model="password"
            type="password"
            :placeholder="mode === 'login' ? '请输入密码' : '最少 8 位'"
          />
        </div>

        <div v-if="mode !== 'login'" class="form-group">
          <label>确认密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="再次输入密码"
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="loading-spinner" />
          {{ loading ? '处理中...' : title }}
        </button>
      </form>

      <div class="auth-footer">
        <template v-if="mode === 'login'">
          <span class="link" @click="switchMode('register')">注册账号</span>
          <span class="sep">·</span>
          <span class="link" @click="switchMode('reset')">忘记密码</span>
        </template>
        <template v-else>
          <span class="link" @click="switchMode('login')">返回登录</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: $bg-deep;
  position: relative;
}

.auth-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  -webkit-app-region: drag;
}

.auth-card {
  width: 380px;
  padding: $spacing-2xl;
  background: $bg-elevated;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  border: 1px solid $border-color;
}

.auth-header {
  text-align: center;
  margin-bottom: $spacing-xl;
}

.auth-logo {
  width: 48px;
  height: 48px;
  margin: 0 auto $spacing-md;
  background: $accent-color;
  color: white;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
}

.auth-title {
  font-size: $font-2xl;
  font-weight: 700;
  color: $text-primary;
  margin: 0 0 $spacing-xs;
}

.auth-subtitle {
  font-size: $font-md;
  color: $text-secondary;
  margin: 0;
}

.auth-message {
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-sm;
  font-size: $font-sm;
  margin-bottom: $spacing-md;

  &.auth-error {
    background: rgba($danger-color, 0.08);
    color: $danger-color;
    border: 1px solid rgba($danger-color, 0.2);
  }

  &.auth-success {
    background: rgba($success-color, 0.08);
    color: $success-color;
    border: 1px solid rgba($success-color, 0.2);
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    font-size: $font-sm;
    font-weight: 500;
    color: $text-secondary;
  }

  input {
    height: 40px;
    padding: 0 $spacing-md;
    border: 1px solid $border-light;
    border-radius: $radius-md;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-md;
    outline: none;
    transition:
      border-color $transition-fast,
      box-shadow $transition-fast;

    &:focus {
      border-color: $accent-color;
      box-shadow: $shadow-glow;
    }

    &::placeholder {
      color: $text-muted;
    }
  }
}

.code-input {
  display: flex;
  gap: $spacing-sm;

  input {
    flex: 1;
  }

  .send-code-btn {
    flex-shrink: 0;
    padding: 0 $spacing-md;
    height: 40px;
    background: transparent;
    border: 1px solid $accent-color;
    border-radius: $radius-md;
    color: $accent-color;
    font-size: $font-sm;
    cursor: pointer;
    transition: all $transition-fast;
    white-space: nowrap;

    &:hover:not(:disabled) {
      background: $accent-soft;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.submit-btn {
  height: 44px;
  margin-top: $spacing-sm;
  background: $accent-color;
  color: white;
  border: none;
  border-radius: $radius-md;
  font-size: $font-lg;
  font-weight: 600;
  cursor: pointer;
  transition: background $transition-fast;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;

  &:hover:not(:disabled) {
    background: $accent-hover;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-footer {
  text-align: center;
  margin-top: $spacing-lg;
  font-size: $font-sm;
  color: $text-muted;

  .link {
    color: $accent-color;
    cursor: pointer;
    transition: color $transition-fast;

    &:hover {
      color: $accent-hover;
      text-decoration: underline;
    }
  }

  .sep {
    margin: 0 $spacing-sm;
  }
}
</style>
