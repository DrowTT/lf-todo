<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronDown, Flame, ListTodo, Play, Square, Target, Trophy, Zap } from 'lucide-vue-next'
import { usePomodoroStore } from '../store/pomodoro'
import { useSettingsStore } from '../store/settings'

const pomodoroStore = usePomodoroStore()
const settingsStore = useSettingsStore()
const {
  activeSession,
  activeTaskLabel,
  focusDurationLabel,
  isBusy,
  isRunning,
  formattedRemaining,
  progressRatio,
  taskCompletedCount,
  todayCompletedCount,
  totalCompletedCount,
  weekCompletedCount
} = storeToRefs(pomodoroStore)
const { settings, isSavingPomodoroDuration } = storeToRefs(settingsStore)

interface PomodoroDurationOption {
  value: number
  label: string
}

const pomodoroDurationOptions: PomodoroDurationOption[] = [
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 20, label: '20 分钟' },
  { value: 25, label: '25 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 45, label: '45 分钟' },
  { value: 60, label: '60 分钟' }
]

const pomodoroDurationMinutes = computed(() =>
  Math.round(settings.value.pomodoro.focusDurationSeconds / 60)
)
const pomodoroDurationLabel = computed(() => {
  const option = pomodoroDurationOptions.find((item) => item.value === pomodoroDurationMinutes.value)
  return option?.label ?? `${pomodoroDurationMinutes.value} 分钟`
})
const durationMenuOpen = ref(false)
const durationMenuRef = ref<HTMLElement | null>(null)

// 圆环参数 — 稍微缩小以适配垂直布局
const RING_RADIUS = 110
const RING_STROKE = 5
const RING_CENTER = RING_RADIUS + RING_STROKE + 10
const RING_SIZE = RING_CENTER * 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

// 圆环进度偏移量（SVG stroke-dashoffset）
const ringOffset = computed(() => {
  return RING_CIRCUMFERENCE * (1 - progressRatio.value)
})

const progressPercent = computed(() => `${Math.round(progressRatio.value * 100)}%`)
const activeSessionLabel = computed(() => {
  if (!activeSession.value) return '待开始'
  return activeSession.value.source === 'task' ? '任务专注' : '自由专注'
})

// 提示区域折叠状态
const tipsExpanded = ref(false)

async function toggleDurationMenu() {
  if (isRunning.value) return

  durationMenuOpen.value = !durationMenuOpen.value
  if (durationMenuOpen.value) {
    await nextTick()
  }
}

async function selectDuration(minutes: number) {
  durationMenuOpen.value = false
  if (minutes === pomodoroDurationMinutes.value) return
  await settingsStore.setPomodoroFocusDuration(minutes * 60)
}

function handlePointerDown(event: MouseEvent) {
  const target = event.target as Node
  if (durationMenuOpen.value && durationMenuRef.value && !durationMenuRef.value.contains(target)) {
    durationMenuOpen.value = false
  }
}

onMounted(() => {
  void settingsStore.hydrate()
  void pomodoroStore.hydrate()
  document.addEventListener('mousedown', handlePointerDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handlePointerDown)
})
</script>

<template>
  <section class="pomo" :class="{ 'pomo--running': isRunning }">
    <!-- 运行态径向光晕（背景装饰） -->
    <div v-if="isRunning" class="pomo__ambient" />

    <!-- 页面标题栏 -->
    <header class="pomo__header">
      <h1 class="pomo__title">专注计时</h1>
      <div class="pomo__header-actions">
        <span
          class="pomo__status-pill"
          :class="{ 'pomo__status-pill--active': isRunning }"
        >
          <span v-if="isRunning" class="pomo__status-dot" />
          {{ activeSessionLabel }}
        </span>

        <div ref="durationMenuRef" class="pomo__duration">
          <button
            class="pomo__duration-trigger"
            :class="{ 'pomo__duration-trigger--open': durationMenuOpen }"
            type="button"
            :disabled="isRunning || isSavingPomodoroDuration"
            @click="toggleDurationMenu"
          >
            <span class="pomo__duration-label">时长</span>
            <span class="pomo__duration-value">{{ pomodoroDurationLabel }}</span>
            <ChevronDown
              :size="13"
              class="pomo__duration-chevron"
              :class="{ 'pomo__duration-chevron--open': durationMenuOpen }"
            />
          </button>

          <Transition name="duration-pop">
            <div v-if="durationMenuOpen" class="pomo__duration-panel">
              <button
                v-for="option in pomodoroDurationOptions"
                :key="option.value"
                class="pomo__duration-option"
                :class="{
                  'pomo__duration-option--active': option.value === pomodoroDurationMinutes
                }"
                type="button"
                @click="selectDuration(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- 核心区域：圆环 + 按钮（垂直居中） -->
    <div class="pomo__core">
      <div class="pomo__ring-wrapper">
        <!-- SVG 圆环 -->
        <svg
          class="pomo__ring-svg"
          :width="RING_SIZE"
          :height="RING_SIZE"
          :viewBox="`0 0 ${RING_SIZE} ${RING_SIZE}`"
        >
          <defs>
            <!-- 进度弧渐变 -->
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#2563eb" />
            </linearGradient>
            <!-- 运行态光晕渐变 -->
            <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(37, 99, 235, 0.08)" />
              <stop offset="100%" stop-color="rgba(37, 99, 235, 0)" />
            </radialGradient>
          </defs>

          <!-- 运行态背景光圈 -->
          <circle
            v-if="isRunning"
            :cx="RING_CENTER"
            :cy="RING_CENTER"
            :r="RING_RADIUS + 30"
            fill="url(#glowGradient)"
          />

          <!-- 底圈轨道 -->
          <circle
            class="pomo__ring-track"
            :cx="RING_CENTER"
            :cy="RING_CENTER"
            :r="RING_RADIUS"
            fill="none"
            :stroke-width="RING_STROKE"
          />

          <!-- 进度圆弧 -->
          <circle
            class="pomo__ring-progress"
            :class="{ 'pomo__ring-progress--running': isRunning }"
            :cx="RING_CENTER"
            :cy="RING_CENTER"
            :r="RING_RADIUS"
            fill="none"
            :stroke-width="RING_STROKE + 1"
            stroke="url(#progressGradient)"
            stroke-linecap="round"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="ringOffset"
          />

          <!-- 运行时外层光晕弧 -->
          <circle
            v-if="isRunning"
            class="pomo__ring-glow"
            :cx="RING_CENTER"
            :cy="RING_CENTER"
            :r="RING_RADIUS"
            fill="none"
            :stroke-width="RING_STROKE + 8"
            stroke-linecap="round"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="ringOffset"
          />
        </svg>

        <!-- 圆环内部内容 -->
        <div class="pomo__ring-content">
          <div v-if="activeTaskLabel" class="pomo__task-label">
            <ListTodo :size="11" />
            <span>{{ activeTaskLabel }}</span>
          </div>
          <div class="pomo__time-display">{{ formattedRemaining }}</div>
          <div class="pomo__progress-text">{{ progressPercent }}</div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="pomo__actions">
        <button
          v-if="!isRunning"
          class="pomo__btn pomo__btn--start"
          type="button"
          :disabled="isBusy"
          @click="pomodoroStore.start()"
        >
          <Play :size="14" />
          <span>开始 {{ focusDurationLabel }}专注</span>
        </button>

        <button
          v-else
          class="pomo__btn pomo__btn--cancel"
          type="button"
          :disabled="isBusy"
          @click="pomodoroStore.cancel()"
        >
          <Square :size="12" />
          <span>取消本轮</span>
        </button>
      </div>
    </div>

    <!-- 水平统计条 -->
    <div class="pomo__stats-strip">
      <div class="pomo__stat-item">
        <Flame :size="13" class="pomo__stat-icon pomo__stat-icon--today" />
        <span class="pomo__stat-label">今日</span>
        <strong class="pomo__stat-value">{{ todayCompletedCount }}</strong>
      </div>
      <div class="pomo__stat-divider" />
      <div class="pomo__stat-item">
        <Zap :size="13" class="pomo__stat-icon pomo__stat-icon--week" />
        <span class="pomo__stat-label">本周</span>
        <strong class="pomo__stat-value">{{ weekCompletedCount }}</strong>
      </div>
      <div class="pomo__stat-divider" />
      <div class="pomo__stat-item">
        <Trophy :size="13" class="pomo__stat-icon pomo__stat-icon--total" />
        <span class="pomo__stat-label">累计</span>
        <strong class="pomo__stat-value">{{ totalCompletedCount }}</strong>
      </div>
      <div class="pomo__stat-divider" />
      <div class="pomo__stat-item">
        <Target :size="13" class="pomo__stat-icon pomo__stat-icon--task" />
        <span class="pomo__stat-label">绑定</span>
        <strong class="pomo__stat-value">{{ taskCompletedCount }}</strong>
      </div>
    </div>

    <!-- 可折叠使用提示 -->
    <div class="pomo__tips" :class="{ 'pomo__tips--open': tipsExpanded }">
      <button class="pomo__tips-toggle" type="button" @click="tipsExpanded = !tipsExpanded">
        <span class="pomo__tips-toggle-label">使用提示</span>
        <ChevronDown :size="13" class="pomo__tips-chevron" />
      </button>

      <Transition name="tips-slide">
        <div v-if="tipsExpanded" class="pomo__tips-body">
          <div class="pomo__tip">
            <span class="pomo__tip-num">1</span>
            <span>开始后持续倒计时，当前版本不提供暂停。</span>
          </div>
          <div class="pomo__tip">
            <span class="pomo__tip-num">2</span>
            <span>倒计时结束会触发桌面通知并累计番茄数。</span>
          </div>
          <div class="pomo__tip">
            <span class="pomo__tip-num">3</span>
            <span>从待办列表的播放按钮开始，可将会话绑定到对应任务。</span>
          </div>
          <div class="pomo__tip">
            <span class="pomo__tip-num">4</span>
            <span>手动取消或关闭应用不会记入统计。</span>
          </div>
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

/* ============================================
 * 番茄钟 — Focused Zen 沉浸式专注仪表盘
 * 垂直居中单列布局，Arctic Blue 设计系统
 * ============================================ */

.pomo {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  overflow-y: auto;
  background: $bg-deep;
  padding: $spacing-xl $spacing-2xl $spacing-lg;
  gap: 0;
  transition: background-color 0.6s ease;

  /* 运行态：背景微调至更深的蓝灰色，增强沉浸感 */
  &--running {
    background: #eaf0f8;
  }
}

/* ---- 运行态径向光晕（背景装饰层） ---- */
.pomo__ambient {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba($accent-color, 0.06) 0%,
    rgba($accent-color, 0.02) 40%,
    transparent 70%
  );
  pointer-events: none;
  animation: ambient-breathe 4s ease-in-out infinite;
}

@keyframes ambient-breathe {
  0%, 100% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.08);
  }
}

/* ---- 页面标题栏 ---- */
.pomo__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  width: 100%;
  max-width: 480px;
  margin-bottom: $spacing-sm;
}

.pomo__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.pomo__title {
  margin: 0;
  font-size: $font-lg;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -0.01em;
}

.pomo__status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 100px;
  background: rgba($accent-color, 0.05);
  color: $text-muted;
  font-size: $font-xs;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: all $transition-normal;

  &--active {
    background: rgba($accent-color, 0.1);
    color: $accent-color;
  }
}

.pomo__duration {
  position: relative;
}

.pomo__duration-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(37, 99, 235, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  color: $text-secondary;
  font-size: $font-xs;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition:
    border-color $transition-normal,
    background-color $transition-normal,
    box-shadow $transition-normal,
    color $transition-normal;

  &:hover:not(:disabled),
  &--open {
    color: $accent-color;
    background: rgba(255, 255, 255, 0.88);
    border-color: rgba(37, 99, 235, 0.16);
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.pomo__duration-label {
  color: $text-muted;
}

.pomo__duration-value {
  color: inherit;
  font-variant-numeric: tabular-nums;
}

.pomo__duration-chevron {
  color: inherit;
  transition: transform $transition-normal;

  &--open {
    transform: rotate(180deg);
  }
}

.pomo__duration-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 108px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  z-index: 5;
}

.pomo__duration-option {
  display: flex;
  align-items: center;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: $text-secondary;
  font-size: $font-sm;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color $transition-fast,
    color $transition-fast;

  &:hover {
    background: rgba(37, 99, 235, 0.06);
    color: $accent-color;
  }

  &--active {
    background: rgba(37, 99, 235, 0.09);
    color: $accent-color;
  }
}

.pomo__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $accent-color;
  animation: status-pulse 1.8s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% {
    opacity: 0.4;
    box-shadow: 0 0 0 0 rgba($accent-color, 0.3);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 0 4px rgba($accent-color, 0);
  }
}

/* ---- 核心区域（圆环 + 按钮，垂直居中） ---- */
.pomo__core {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-xl;
  width: 100%;
  min-height: 0;
  position: relative;
  z-index: 1;
}

/* ---- 圆环计时器 ---- */
.pomo__ring-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pomo__ring-svg {
  transform: rotate(-90deg);
  filter: drop-shadow(0 2px 16px rgba($accent-color, 0.05));
  transition: filter 0.4s ease;

  .pomo--running & {
    filter: drop-shadow(0 4px 24px rgba($accent-color, 0.1));
  }
}

.pomo__ring-track {
  stroke: $border-color;
  opacity: 0.5;
}

.pomo__ring-progress {
  transition: stroke-dashoffset 1s linear;
  opacity: 0.85;

  &--running {
    opacity: 1;
  }
}

.pomo__ring-glow {
  stroke: rgba($accent-color, 0.08);
  transition: stroke-dashoffset 1s linear;
  animation: ring-pulse 2.8s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.5;
  }
}

/* 圆环内部内容 */
.pomo__ring-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  pointer-events: none;
}

.pomo__task-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 150px;
  padding: 3px 10px;
  border-radius: 100px;
  background: $accent-soft;
  color: $accent-color;
  font-size: $font-xs;
  font-weight: 600;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pomo__time-display {
  font-size: 46px;
  font-weight: 300;
  color: $text-primary;
  letter-spacing: -0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  margin-top: 6px;
  transition: color 0.3s ease;

  .pomo--running & {
    color: $accent-color;
  }
}

.pomo__progress-text {
  font-size: $font-xs;
  color: $text-muted;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}

/* ---- 操作按钮 ---- */
.pomo__actions {
  width: 100%;
  max-width: 220px;
}

.pomo__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  height: 40px;
  padding: 0 $spacing-lg;
  border-radius: $radius-md;
  border: 1px solid transparent;
  font-size: $font-sm;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform $transition-fast,
    box-shadow $transition-fast,
    background-color $transition-fast,
    border-color $transition-fast,
    opacity $transition-fast;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  &:not(:disabled):hover {
    transform: none;
  }

  &:not(:disabled):active {
    transform: none;
  }
}

.pomo__btn--start {
  color: #fff;
  background: $accent-color;
  box-shadow: 0 6px 20px rgba($accent-color, 0.2);

  &:not(:disabled):hover {
    background: $accent-hover;
    box-shadow: 0 8px 24px rgba($accent-color, 0.28);
  }
}

.pomo__btn--cancel {
  color: $text-muted;
  background: transparent;
  border-color: $border-color;

  &:not(:disabled):hover {
    color: $danger-color;
    border-color: rgba($danger-color, 0.3);
    background: rgba($danger-color, 0.03);
  }
}

/* ---- 水平统计条 ---- */
.pomo__stats-strip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 100%;
  max-width: 480px;
  padding: $spacing-md $spacing-lg;
  background: $bg-elevated;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  position: relative;
  z-index: 1;
}

.pomo__stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 $spacing-lg;
}

.pomo__stat-icon {
  flex-shrink: 0;

  &--today {
    color: #ea580c;
  }
  &--week {
    color: #7c3aed;
  }
  &--total {
    color: $accent-color;
  }
  &--task {
    color: $success-color;
  }
}

.pomo__stat-label {
  font-size: $font-xs;
  color: $text-muted;
  font-weight: 500;
}

.pomo__stat-value {
  font-size: $font-lg;
  font-weight: 700;
  color: $text-primary;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.pomo__stat-divider {
  width: 1px;
  height: 20px;
  background: $border-color;
  flex-shrink: 0;
}

/* ---- 可折叠提示 ---- */
.pomo__tips {
  flex-shrink: 0;
  width: 100%;
  max-width: 480px;
  margin-top: $spacing-sm;
  background: transparent;
  border-radius: $radius-md;
  overflow: hidden;
  position: relative;
  z-index: 1;

  &--open {
    background: $bg-elevated;
    border: 1px solid $border-color;

    .pomo__tips-chevron {
      transform: rotate(180deg);
    }
  }
}

.pomo__tips-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: $spacing-sm $spacing-lg;
  background: transparent;
  border: none;
  cursor: pointer;
  color: $text-muted;
  font-size: $font-xs;
  font-weight: 500;
  transition: color $transition-fast;

  &:hover {
    color: $text-secondary;
  }
}

.pomo__tips-toggle-label {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.pomo__tips-chevron {
  transition: transform $transition-normal;
}

.pomo__tips-body {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  padding: 0 $spacing-lg $spacing-md;
}

.pomo__tip {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  font-size: $font-xs;
  color: $text-secondary;
  line-height: 1.6;
}

.pomo__tip-num {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border-radius: 50%;
  background: rgba($accent-color, 0.06);
  color: $accent-color;
  font-size: 10px;
  font-weight: 700;
}

/* ---- 折叠动画 ---- */
.tips-slide-enter-active {
  transition: all 0.25s ease;
}

.tips-slide-leave-active {
  transition: all 0.15s ease;
}

.tips-slide-enter-from,
.tips-slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.duration-pop-enter-active,
.duration-pop-leave-active {
  transition: all 0.16s ease;
}

.duration-pop-enter-from,
.duration-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

/* ---- 响应式 ---- */
@media (max-width: 720px) {
  .pomo {
    padding: $spacing-lg;
  }

  .pomo__header,
  .pomo__stats-strip,
  .pomo__tips {
    max-width: 100%;
  }

  .pomo__stat-item {
    padding: 0 $spacing-sm;
  }

  .pomo__time-display {
    font-size: 38px;
  }

  .pomo__ambient {
    width: 300px;
    height: 300px;
  }
}
</style>
