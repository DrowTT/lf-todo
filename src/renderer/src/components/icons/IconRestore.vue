<template>
  <!-- Windows 标准还原图标：两个重叠方框 -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 13 13"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
  >
    <rect x="3" y="5" width="7" height="7" rx="0.5" />
    <path d="M5 5V3.5a.5.5 0 0 1 .5-.5H10.5a.5.5 0 0 1 .5.5V8.5a.5.5 0 0 1-.5.5H10" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
    strokeWidth?: number
  }>(),
  {
    size: 13,
    strokeWidth: 1.2
  }
)
</script>
