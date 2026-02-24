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
        <IconPin />
      </button>
      <button
        class="title-bar__btn title-bar__btn--minimize"
        @click="handleMinimize"
        title="最小化"
      >
        <IconMinimize />
      </button>
      <button class="title-bar__btn title-bar__btn--close" @click="handleClose" title="关闭">
        <IconClose />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import IconPin from '@renderer/components/icons/IconPin.vue'
import IconMinimize from '@renderer/components/icons/IconMinimize.vue'
import IconClose from '@renderer/components/icons/IconClose.vue'

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
  height: 30px;
  background: $bg-secondary;
  color: $text-primary;
  user-select: none;
  border-bottom: 1px solid $border-color;

  &__drag-area {
    flex: 1;
    display: flex;
    align-items: center;
    height: 100%;
    padding-left: $spacing-md;
    -webkit-app-region: drag;
  }

  &__title {
    font-size: $font-sm;
    font-weight: 500;
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
    width: 44px;
    height: 100%;
    background: transparent;
    border: none;
    color: $text-primary;
    font-size: $font-sm;
    cursor: pointer;
    transition: background-color $transition-fast;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    &--pin {
      &.is-active {
        // background: rgba(76, 175, 80, 0.25);
        background: rgba(61, 79, 92, 0.75);
        color: $success-color;
      }

      &:hover {
        background: rgba(61, 79, 92, 0.35);
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
