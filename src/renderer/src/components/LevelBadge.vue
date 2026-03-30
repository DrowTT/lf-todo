<script setup lang="ts">
/**
 * 等级标签组件 — 展示用户等级数字、名称、颜色
 * 支持 Lv.51+ 传奇段位的赤金渐变效果
 */
import { computed } from 'vue'

const props = defineProps<{
  level: number
  /** 紧凑模式：只显示等级数字，不显示名称 */
  compact?: boolean
}>()

// ─── 等级名称映射 ───
function getLevelName(level: number): string {
  if (level <= 5) return '初学者'
  if (level <= 10) return '践行者'
  if (level <= 20) return '专注者'
  if (level <= 35) return '掌控者'
  if (level <= 50) return '征服者'
  return '传奇'
}

// ─── 等级颜色映射 ───
function getLevelColor(level: number): string {
  if (level <= 5) return '#B0B0B0'
  if (level <= 10) return '#4CAF50'
  if (level <= 20) return '#2196F3'
  if (level <= 35) return '#9C27B0'
  if (level <= 50) return '#FF9800'
  return '#FF4444'
}

// 是否为传奇段位（使用渐变色）
const isLegendary = computed(() => props.level > 50)
const levelName = computed(() => getLevelName(props.level))
const levelColor = computed(() => getLevelColor(props.level))
</script>

<template>
  <span
    class="level-badge"
    :class="{
      'level-badge--legendary': isLegendary,
      'level-badge--compact': compact
    }"
    :style="!isLegendary ? { color: levelColor, borderColor: levelColor } : {}"
  >
    Lv.{{ level }}
    <template v-if="!compact">{{ levelName }}</template>
  </span>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.level-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid;
  border-radius: 3px;
  line-height: 18px;
  white-space: nowrap;
  transition: all $transition-fast;

  // 紧凑模式
  &--compact {
    padding: 0 4px;
    font-size: 9px;
    line-height: 16px;
  }

  // 传奇段位 — 赤金渐变 + 发光效果
  &--legendary {
    background: linear-gradient(135deg, #FF4444, #FFD700);
    color: white;
    border-color: transparent;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    animation: legendary-glow 2s ease-in-out infinite alternate;
  }
}

@keyframes legendary-glow {
  from {
    box-shadow: 0 0 4px rgba(255, 68, 68, 0.3);
  }
  to {
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
  }
}
</style>
