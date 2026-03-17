<template>
  <div class="title-bar">
    <div class="title-bar__drag-area">
      <div class="title-bar__title">极简待办</div>
    </div>
    <div class="title-bar__controls">
      <button
        class="title-bar__btn title-bar__btn--pin"
        :class="{ 'is-active': isAlwaysOnTop }"
        @click="handleTogglePin"
        title="置顶"
      >
        <Pin :size="15" style="transform: rotate(45deg)" />
      </button>
      <button
        class="title-bar__btn title-bar__btn--minimize"
        @click="handleMinimize"
        title="最小化"
      >
        <Minus :size="14" />
      </button>
      <button class="title-bar__btn title-bar__btn--close" @click="handleClose" title="关闭">
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Pin, Minus, X } from 'lucide-vue-next'

const isAlwaysOnTop = ref(false)

// 检查是否在 Electron 环境中（window.api 由 preload 脚本注入）
const isElectron = typeof window !== 'undefined' && window.api !== undefined

const handleTogglePin = () => {
  if (isElectron) {
    window.api.window.toggleAlwaysOnTop()
  }
}

const handleMinimize = () => {
  if (isElectron) {
    window.api.window.minimize()
  }
}

const handleClose = () => {
  if (isElectron) {
    window.api.window.close()
  }
}

onMounted(() => {
  if (isElectron) {
    window.api.window.onAlwaysOnTopChanged((flag: boolean) => {
      isAlwaysOnTop.value = flag
    })
  }
})
</script>

<style scoped lang="scss">
@use '../styles/variables' as *;

.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  background: $bg-sidebar;
  color: $text-primary;
  user-select: none;
  border-bottom: 1px solid $border-color;

  &__drag-area {
    flex: 1;
    display: flex;
    align-items: center;
    height: 100%;
    padding-left: $spacing-lg;
    -webkit-app-region: drag;
  }

  &__title {
    font-size: $font-sm;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: $text-secondary;
  }

  &__controls {
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 100%;
    background: transparent;
    border: none;
    color: $text-muted;
    font-size: $font-sm;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
      color: $text-primary;
    }

    &--pin {
      &.is-active {
        background: $accent-soft;
        color: $accent-color;
      }

      &:hover {
        background: $accent-soft;
        color: $accent-color;
      }
    }

    &--close {
      &:hover {
        background: $danger-color;
        color: white;
      }
    }
  }
}
</style>
