<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const contentRef = ref<HTMLElement | null>(null)

// 当前选中的套餐
const selectedPlan = ref<'monthly' | 'yearly'>('yearly')

function handleClose(): void {
  emit('close')
}

function handlePurchase(): void {
  // V2 仅为 UI 骨架，暂不对接真实支付
  alert('功能开发中，敬请期待！')
}

// 弹窗出现时自动聚焦
watch(
  () => props.visible,
  (val) => {
    if (val) nextTick(() => contentRef.value?.focus())
  }
)
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <Transition name="fade">
      <div v-if="visible" class="pro-overlay" @click="handleClose" />
    </Transition>

    <!-- 弹窗 -->
    <Transition name="slide">
      <div
        v-if="visible"
        class="pro-wrapper"
        @click.self="handleClose"
        @keydown.escape="handleClose"
      >
        <div ref="contentRef" class="pro-content" tabindex="-1" @click.stop>
          <!-- 头部 -->
          <div class="pro-header">
            <span class="pro-badge">PRO</span>
            <h2 class="pro-title">升级 Pro 会员</h2>
            <p class="pro-desc">解锁全部高级功能，让效率起飞</p>
          </div>

          <!-- 权益列表 -->
          <ul class="pro-features">
            <li><span class="feature-icon">📂</span>无限分类数量</li>
            <li><span class="feature-icon">📋</span>子待办（子任务）功能</li>
            <li><span class="feature-icon">⌨️</span>子任务快捷键设置</li>
            <li><span class="feature-icon">🎨</span>更多主题（即将推出）</li>
          </ul>

          <!-- 套餐选择 -->
          <div class="plan-options">
            <button
              class="plan-card"
              :class="{ active: selectedPlan === 'monthly' }"
              @click="selectedPlan = 'monthly'"
            >
              <span class="plan-period">月度</span>
              <span class="plan-price">¥9.9<small>/月</small></span>
            </button>
            <button
              class="plan-card"
              :class="{ active: selectedPlan === 'yearly' }"
              @click="selectedPlan = 'yearly'"
            >
              <span class="plan-best">推荐</span>
              <span class="plan-period">年度</span>
              <span class="plan-price">¥68<small>/年</small></span>
              <span class="plan-save">省 ¥50.8</span>
            </button>
          </div>

          <!-- 操作按钮 -->
          <div class="pro-actions">
            <button class="pro-btn pro-btn--primary" @click="handlePurchase">
              立即升级
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 9998;
}

.pro-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.pro-content {
  width: 400px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: $radius-xl;
  box-shadow: $shadow-lg;
  padding: $spacing-2xl;
  outline: none;
}

// ─── 头部 ───
.pro-header {
  text-align: center;
  margin-bottom: $spacing-xl;
}

.pro-badge {
  display: inline-block;
  padding: 2px $spacing-md;
  background: linear-gradient(135deg, #f59e0b, #f97316);
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
}

// ─── 权益列表 ───
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

  .feature-icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }
}

// ─── 套餐选择 ───
.plan-options {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-xl;
}

.plan-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-lg $spacing-md;
  border: 2px solid $border-color;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all $transition-normal;
  position: relative;

  &:hover {
    border-color: $accent-color;
  }

  &.active {
    border-color: $accent-color;
    background: $accent-soft;
  }
}

.plan-best {
  position: absolute;
  top: -10px;
  right: -4px;
  padding: 1px $spacing-sm;
  background: linear-gradient(135deg, #f59e0b, #f97316);
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
}

// ─── 操作按钮 ───
.pro-actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.pro-btn {
  width: 100%;
  height: 42px;
  border: none;
  border-radius: $radius-md;
  font-size: $font-lg;
  font-weight: 600;
  cursor: pointer;
  transition: all $transition-normal;

  &--primary {
    background: linear-gradient(135deg, $accent-color, #6366f1);
    color: white;

    &:hover {
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
      transform: translateY(-1px);
    }
  }

  &--secondary {
    background: transparent;
    color: $text-muted;

    &:hover {
      color: $text-secondary;
    }
  }
}

// ─── 动画 ───
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
