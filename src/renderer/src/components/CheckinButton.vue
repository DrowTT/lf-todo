<script setup lang="ts">
/**
 * 签到按钮组件 — 每日签到、经验值进度展示
 * 包含签到动效、经验值弹出提示、进度条
 */
import { ref, computed, onMounted } from 'vue'
import { getLevelInfo, checkin, type LevelInfo } from '../api/level'
import LevelBadge from './LevelBadge.vue'

const emit = defineEmits<{
  /** 签到或等级信息更新时触发，父组件可根据此刷新 */
  'level-updated': [info: LevelInfo]
}>()

// ─── 状态 ───
const levelInfo = ref<LevelInfo | null>(null)
const isLoading = ref(false)
const isCheckinLoading = ref(false)
const showXpToast = ref(false)
const xpGained = ref(0)
const checkinSuccess = ref(false)

// ─── 计算属性 ───
const checkinDone = computed(() => levelInfo.value?.daily.checkinDone ?? false)
const progressPercent = computed(() => {
  if (!levelInfo.value || levelInfo.value.xpNeeded <= 0) return 0
  return Math.min(100, Math.round((levelInfo.value.xpProgress / levelInfo.value.xpNeeded) * 100))
})

// ─── 加载等级信息 ───
async function fetchLevel(): Promise<void> {
  isLoading.value = true
  try {
    const res = await getLevelInfo()
    levelInfo.value = res.data
    emit('level-updated', res.data)
  } catch (e) {
    console.error('[CheckinButton] 获取等级信息失败:', e)
  } finally {
    isLoading.value = false
  }
}

// ─── 签到 ───
async function handleCheckin(): Promise<void> {
  if (checkinDone.value || isCheckinLoading.value) return

  isCheckinLoading.value = true
  try {
    const res = await checkin()
    xpGained.value = res.data.xpGain
    checkinSuccess.value = true

    // 显示经验值弹出提示
    showXpToast.value = true
    setTimeout(() => {
      showXpToast.value = false
    }, 2000)

    // 刷新等级信息
    await fetchLevel()
  } catch (e: any) {
    console.error('[CheckinButton] 签到失败:', e)
  } finally {
    isCheckinLoading.value = false
  }
}

onMounted(() => {
  void fetchLevel()
})

// 暴露刷新方法，供父组件调用
defineExpose({ fetchLevel })
</script>

<template>
  <div class="checkin-section">
    <!-- 等级信息展示 -->
    <div v-if="levelInfo" class="level-info">
      <div class="level-info__header">
        <LevelBadge :level="levelInfo.currentLevel" />
        <span class="level-info__xp">{{ levelInfo.totalXp }} XP</span>
      </div>

      <!-- 经验值进度条 -->
      <div class="level-info__progress">
        <div class="progress-bar">
          <div
            class="progress-bar__fill"
            :style="{ width: progressPercent + '%', backgroundColor: levelInfo.levelColor }"
          />
        </div>
        <span class="progress-bar__text">
          {{ levelInfo.xpProgress }} / {{ levelInfo.xpNeeded }}
        </span>
      </div>

      <!-- 今日数据 -->
      <div class="level-info__daily">
        <span class="daily-stat">
          今日 {{ levelInfo.daily.totalXpToday }} XP
        </span>
        <span class="daily-stat daily-stat--sub">
          任务 {{ levelInfo.daily.taskXpCount }}/3
        </span>
      </div>
    </div>

    <!-- 签到按钮 -->
    <button
      class="checkin-btn"
      :class="{
        'checkin-btn--done': checkinDone,
        'checkin-btn--loading': isCheckinLoading,
        'checkin-btn--success': checkinSuccess && checkinDone
      }"
      :disabled="checkinDone || isCheckinLoading"
      @click="handleCheckin"
    >
      <template v-if="isCheckinLoading">
        <span class="checkin-btn__spinner" />
        签到中...
      </template>
      <template v-else-if="checkinDone">
        <span class="checkin-btn__icon">✓</span>
        已签到
      </template>
      <template v-else>
        <span class="checkin-btn__icon">📅</span>
        每日签到 +5 XP
      </template>
    </button>

    <!-- 经验值获得提示 -->
    <Transition name="xp-toast">
      <div v-if="showXpToast" class="xp-toast">
        +{{ xpGained }} XP ✨
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.checkin-section {
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid $border-subtle;
  position: relative;
}

// ─── 等级信息 ───
.level-info {
  margin-bottom: $spacing-sm;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-xs;
  }

  &__xp {
    font-size: $font-xs;
    color: $text-muted;
    font-weight: 500;
  }

  &__progress {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-xs;
  }

  &__daily {
    display: flex;
    align-items: center;
    gap: $spacing-md;
  }
}

// ─── 进度条 ───
.progress-bar {
  flex: 1;
  height: 4px;
  background: $border-color;
  border-radius: 2px;
  overflow: hidden;

  &__fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    min-width: 2px;
  }

  &__text {
    font-size: 10px;
    color: $text-muted;
    white-space: nowrap;
    flex-shrink: 0;
  }
}

// ─── 每日数据 ───
.daily-stat {
  font-size: $font-xs;
  color: $text-secondary;
  font-weight: 500;

  &--sub {
    color: $text-muted;
  }
}

// ─── 签到按钮 ───
.checkin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  width: 100%;
  height: 32px;
  border: 1px dashed $accent-color;
  border-radius: $radius-md;
  background: transparent;
  color: $accent-color;
  font-size: $font-sm;
  font-weight: 500;
  cursor: pointer;
  transition: all $transition-fast;
  position: relative;
  overflow: hidden;

  &:hover:not(:disabled) {
    background: $accent-soft;
    border-style: solid;
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  // 已签到状态
  &--done {
    border-color: $success-color;
    color: $success-color;
    border-style: solid;
    cursor: default;
    opacity: 0.7;
  }

  // 签到成功动效
  &--success {
    animation: checkin-pulse 0.5s ease;
  }

  // 加载中
  &--loading {
    cursor: wait;
    opacity: 0.7;
  }

  &__icon {
    font-size: $font-md;
  }

  &__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba($accent-color, 0.2);
    border-top-color: $accent-color;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

// ─── 经验值弹出提示 ───
.xp-toast {
  position: absolute;
  top: -8px;
  right: $spacing-lg;
  padding: $spacing-xs $spacing-md;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: white;
  font-size: $font-sm;
  font-weight: 700;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
  pointer-events: none;
  z-index: 10;
}

// ─── 动画 ───
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes checkin-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

// 经验值提示进出动画
.xp-toast-enter-active {
  animation: xp-float-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.xp-toast-leave-active {
  animation: xp-float-out 0.3s ease forwards;
}

@keyframes xp-float-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes xp-float-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-12px) scale(0.9);
  }
}
</style>
