<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import {
  FolderOpen,
  Keyboard,
  ListChecks,
  Palette,
  QrCode,
  RefreshCcw,
  Sparkles
} from 'lucide-vue-next'
import { useProPurchase } from '../composables/useProPurchase'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const contentRef = useTemplateRef<HTMLElement>('content')

const {
  order,
  isCreating,
  isRefreshing,
  isSimulating,
  errorMessage,
  statusLabel,
  paymentModeLabel,
  createOrder,
  refreshOrderStatus,
  simulatePaid,
  reset
} = useProPurchase()

const proPrice = '23'

const expiresAtText = computed(() => {
  if (!order.value?.expiresAt) return '未生成'
  return new Date(order.value.expiresAt).toLocaleString('zh-CN', { hour12: false })
})

const paymentSummary = computed(() => {
  if (!order.value) {
    return '一次买断，后续新增 Pro 能力将持续包含在内。'
  }

  if (order.value.paymentMode === 'mock') {
    return '当前为开发态 Mock 支付链路，订单、轮询与开通逻辑已接通，后续只需替换为真实微信 code_url。'
  }

  return '请使用微信扫码支付，支付成功后客户端会自动刷新 Pro 权限。'
})

const primaryButtonLabel = computed(() => {
  if (order.value?.status === 'PAID') {
    return '继续使用 Pro'
  }

  if (order.value?.status === 'PENDING') {
    if (isRefreshing.value) return '刷新中...'
    return '我已完成支付，刷新状态'
  }

  if (isCreating.value) {
    return '创建订单中...'
  }

  return '23 元永久解锁'
})

const canUsePrimaryAction = computed(() => {
  return !isCreating.value && !isRefreshing.value && !isSimulating.value
})

const canSimulatePayment = computed(() => {
  return (
    order.value?.status === 'PENDING' &&
    order.value.paymentMode === 'mock' &&
    order.value.simulateEnabled
  )
})

const statusClass = computed(() => {
  return order.value ? `payment-panel--${order.value.status.toLowerCase()}` : 'payment-panel--idle'
})

function handleClose(): void {
  emit('close')
}

async function handlePrimaryAction(): Promise<void> {
  if (order.value?.status === 'PAID') {
    handleClose()
    return
  }

  if (order.value?.status === 'PENDING') {
    await refreshOrderStatus()
    return
  }

  await createOrder()
}

async function handleSimulatePaid(): Promise<void> {
  await simulatePaid()
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      nextTick(() => contentRef.value?.focus())
      return
    }

    reset()
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="pro-overlay" @click="handleClose" />
    </Transition>

    <Transition name="slide">
      <div
        v-if="visible"
        class="pro-wrapper"
        @click.self="handleClose"
        @keydown.escape="handleClose"
      >
        <div ref="content" class="pro-content" tabindex="-1" @click.stop>
          <div class="pro-header">
            <span class="pro-badge">PRO</span>
            <h2 class="pro-title">升级 Pro 永久版</h2>
            <p class="pro-desc">{{ paymentSummary }}</p>
          </div>

          <ul class="pro-features">
            <li><FolderOpen :size="16" class="feature-icon" />无限分类数量</li>
            <li><ListChecks :size="16" class="feature-icon" />子待办与子任务能力</li>
            <li><Keyboard :size="16" class="feature-icon" />子任务快捷键设置</li>
            <li><Palette :size="16" class="feature-icon" />更多主题与后续高级能力</li>
          </ul>

          <div class="plan-card plan-card--single">
            <span class="plan-best">当前定价</span>
            <span class="plan-period">永久买断</span>
            <span class="plan-price">￥{{ proPrice }}<small>/一次</small></span>
            <span class="plan-save">支付成功后会自动刷新当前账号的 Pro 权限</span>
          </div>

          <section class="payment-panel" :class="statusClass">
            <div class="payment-panel__header">
              <div>
                <p class="payment-panel__label">支付状态</p>
                <h3 class="payment-panel__title">{{ statusLabel }}</h3>
              </div>
              <span v-if="order" class="payment-panel__mode">{{ paymentModeLabel }}</span>
            </div>

            <template v-if="order">
              <div class="payment-panel__qr">
                <QrCode :size="28" class="payment-panel__qr-icon" />
                <p class="payment-panel__qr-title">
                  {{ order.paymentMode === 'mock' ? '二维码占位区' : '微信扫码支付区' }}
                </p>
                <p class="payment-panel__qr-desc">
                  {{ order.paymentMode === 'mock'
                    ? '当前先展示订单壳与状态流转，真实微信接入后这里将替换成 code_url 生成的二维码。'
                    : '请使用微信扫描二维码完成支付。' }}
                </p>
              </div>

              <dl class="payment-meta">
                <div class="payment-meta__item">
                  <dt>订单号</dt>
                  <dd>{{ order.orderNo }}</dd>
                </div>
                <div class="payment-meta__item">
                  <dt>应付金额</dt>
                  <dd>￥{{ order.amountYuan }}</dd>
                </div>
                <div class="payment-meta__item">
                  <dt>有效期至</dt>
                  <dd>{{ expiresAtText }}</dd>
                </div>
                <div class="payment-meta__item">
                  <dt>商户资料</dt>
                  <dd>{{ order.merchantReady ? '已配置' : '未配置' }}</dd>
                </div>
              </dl>

              <p v-if="order.codeUrl" class="payment-code">
                <span class="payment-code__label">支付会话：</span>
                <code>{{ order.codeUrl }}</code>
              </p>
            </template>

            <template v-else>
              <div class="payment-panel__empty">
                <Sparkles :size="18" />
                <span>创建订单后，这里会显示支付状态、订单号和扫码区域。</span>
              </div>
            </template>

            <p v-if="errorMessage" class="payment-error">{{ errorMessage }}</p>
          </section>

          <div class="pro-actions">
            <button class="pro-btn pro-btn--primary" :disabled="!canUsePrimaryAction" @click="handlePrimaryAction">
              <RefreshCcw v-if="order?.status === 'PENDING'" :size="16" />
              <span>{{ primaryButtonLabel }}</span>
            </button>

            <button
              v-if="canSimulatePayment"
              class="pro-btn pro-btn--ghost"
              :disabled="isSimulating"
              @click="handleSimulatePaid"
            >
              {{ isSimulating ? '模拟支付中...' : '开发态：模拟支付成功' }}
            </button>

            <button class="pro-btn pro-btn--secondary" @click="handleClose">
              以后再说
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.pro-overlay {
  position: fixed;
  inset: 0;
  background-color: rgb(var(--text-primary-rgb) / 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 9998;
}

.pro-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: $spacing-xl;
}

.pro-content {
  width: min(460px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  background: $bg-elevated;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
  box-shadow:
    0 20px 60px rgb(var(--text-primary-rgb) / 0.18),
    0 0 1px rgb(var(--text-primary-rgb) / 0.08);
  padding: $spacing-2xl;
  outline: none;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -60%;
    left: -20%;
    width: 140%;
    height: 100%;
    background: radial-gradient(
      ellipse at center,
      rgb(var(--warning-color-rgb) / 0.07) 0%,
      transparent 70%
    );
    pointer-events: none;
  }
}

.pro-header {
  text-align: center;
  margin-bottom: $spacing-xl;
}

.pro-badge {
  display: inline-block;
  padding: 2px $spacing-md;
  background: $pro-gradient;
  color: white;
  font-size: $font-xs;
  font-weight: 700;
  letter-spacing: 2px;
  border-radius: $radius-sm;
  margin-bottom: $spacing-sm;
}

.pro-title {
  font-size: $font-xl;
  font-weight: 700;
  color: $text-primary;
  margin: $spacing-sm 0 $spacing-xs;
}

.pro-desc {
  font-size: $font-sm;
  color: $text-secondary;
  margin: 0;
  line-height: 1.6;
}

.pro-features {
  list-style: none;
  padding: 0;
  margin: 0 0 $spacing-xl;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  li {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    font-size: $font-md;
    color: $text-primary;
    padding: $spacing-xs 0;
  }
}

.feature-icon {
  color: $accent-color;
  flex-shrink: 0;
}

.plan-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-lg $spacing-md;
  border: 2px solid $border-color;
  border-radius: $radius-lg;
  background: rgb(var(--bg-elevated-rgb) / 0.5);
  position: relative;
  margin-bottom: $spacing-xl;

  &--single {
    border-color: $accent-color;
    background: $accent-soft;
  }
}

.plan-best {
  position: absolute;
  top: 0;
  right: -4px;
  transform: translateY(-50%);
  padding: 1px $spacing-sm;
  background: $pro-gradient;
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: $radius-sm;
}

.plan-period {
  font-size: $font-sm;
  color: $text-secondary;
  font-weight: 500;
}

.plan-price {
  font-size: $font-2xl;
  font-weight: 700;
  color: $text-primary;

  small {
    font-size: $font-sm;
    font-weight: 400;
    color: $text-muted;
  }
}

.plan-save {
  font-size: $font-xs;
  color: $success-color;
  font-weight: 500;
  text-align: center;
}

.payment-panel {
  position: relative;
  border: 1px solid $border-light;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  background:
    linear-gradient(135deg, rgb(var(--bg-elevated-rgb) / 0.94), rgb(var(--bg-primary-rgb) / 0.88)),
    $bg-primary;
  margin-bottom: $spacing-xl;

  &--pending {
    border-color: rgb(var(--accent-color-rgb) / 0.3);
  }

  &--paid {
    border-color: rgb(var(--success-color-rgb) / 0.35);
  }

  &--failed,
  &--expired,
  &--closed {
    border-color: rgb(var(--danger-color-rgb) / 0.25);
  }
}

.payment-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;
}

.payment-panel__label {
  margin: 0 0 2px;
  font-size: $font-xs;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.payment-panel__title {
  margin: 0;
  font-size: $font-xl;
  color: $text-primary;
}

.payment-panel__mode {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: rgb(var(--accent-color-rgb) / 0.12);
  color: $accent-color;
  padding: 4px 10px;
  font-size: $font-xs;
  font-weight: 600;
}

.payment-panel__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  text-align: center;
  padding: $spacing-lg;
  border-radius: $radius-lg;
  border: 1px dashed rgb(var(--text-primary-rgb) / 0.12);
  background:
    linear-gradient(135deg, rgb(var(--accent-color-rgb) / 0.05), transparent),
    rgb(var(--bg-elevated-rgb) / 0.7);
}

.payment-panel__qr-icon {
  color: $accent-color;
}

.payment-panel__qr-title {
  margin: 0;
  font-size: $font-lg;
  font-weight: 600;
  color: $text-primary;
}

.payment-panel__qr-desc {
  margin: 0;
  font-size: $font-sm;
  line-height: 1.6;
  color: $text-secondary;
}

.payment-panel__empty {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md;
  border-radius: $radius-md;
  background: rgb(var(--accent-color-rgb) / 0.08);
  color: $text-secondary;
  font-size: $font-sm;
}

.payment-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-md;
  margin: $spacing-lg 0 0;
}

.payment-meta__item {
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  background: rgb(var(--bg-elevated-rgb) / 0.78);
  border: 1px solid rgb(var(--text-primary-rgb) / 0.06);

  dt {
    margin-bottom: 4px;
    font-size: $font-xs;
    color: $text-muted;
  }

  dd {
    margin: 0;
    font-size: $font-sm;
    color: $text-primary;
    word-break: break-all;
  }
}

.payment-code {
  margin: $spacing-lg 0 0;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  background: rgb(var(--text-primary-rgb) / 0.04);
  color: $text-secondary;
  font-size: $font-xs;
  line-height: 1.6;
  word-break: break-all;
}

.payment-code__label {
  font-weight: 600;
  color: $text-primary;
}

.payment-error {
  margin: $spacing-md 0 0;
  color: $danger-color;
  font-size: $font-sm;
}

.pro-actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.pro-btn {
  width: 100%;
  min-height: 42px;
  border: none;
  border-radius: $radius-md;
  font-size: $font-lg;
  font-weight: 600;
  cursor: pointer;
  transition: all $transition-normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: 0 $spacing-md;

  &:disabled {
    cursor: wait;
    opacity: 0.7;
    transform: none;
    box-shadow: none;
  }

  &--primary {
    background: var(--accent-gradient);
    color: white;

    &:hover:not(:disabled) {
      box-shadow: 0 4px 16px rgb(var(--accent-color-rgb) / 0.3);
      transform: translateY(-1px);
    }
  }

  &--ghost {
    background: rgb(var(--accent-color-rgb) / 0.1);
    color: $accent-color;
    border: 1px solid rgb(var(--accent-color-rgb) / 0.16);

    &:hover:not(:disabled) {
      background: rgb(var(--accent-color-rgb) / 0.14);
    }
  }

  &--secondary {
    background: transparent;
    color: $text-muted;
    border: 1px solid $border-color;

    &:hover:not(:disabled) {
      color: $text-secondary;
      border-color: $border-light;
      background: rgb(var(--text-primary-rgb) / 0.02);
    }
  }
}

@media (max-width: 640px) {
  .pro-wrapper {
    align-items: flex-end;
    padding: $spacing-md;
  }

  .pro-content {
    max-height: 88vh;
    padding: $spacing-xl;
  }

  .payment-meta {
    grid-template-columns: 1fr;
  }
}

.fade-enter-active {
  transition: background-color $transition-slow;
}

.fade-leave-active {
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.fade-enter-from {
  background-color: transparent;
}

.fade-leave-to {
  background-color: transparent;
  opacity: 0;
}

.slide-enter-active {
  transition: transform $transition-spring;
}

.slide-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-enter-from {
  transform: translateY(12px) scale(0.97);
}

.slide-leave-to {
  transform: translateY(8px) scale(0.97);
  opacity: 0;
}
</style>
