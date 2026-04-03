<template>
  <div class="title-bar">
    <div class="title-bar__drag-area">
      <div class="title-bar__title">
        <span class="title-bar__dot"></span>
        极简待办
      </div>
    </div>
    <div class="title-bar__controls">
      <button
        class="title-bar__btn title-bar__btn--pin"
        :class="{ 'is-active': isAlwaysOnTop }"
        title="置顶"
        @click="handleTogglePin"
      >
        <Pin :size="15" style="transform: rotate(45deg)" />
      </button>
      <button
        class="title-bar__btn title-bar__btn--minimize"
        title="最小化"
        @click="handleMinimize"
      >
        <Minus :size="14" />
      </button>
      <button
        class="title-bar__btn title-bar__btn--maximize"
        :title="isMaximized ? '还原' : '最大化'"
        @click="handleToggleMaximize"
      >
        <IconRestore v-if="isMaximized" />
        <Square v-else :size="13" :stroke-width="1.4" />
      </button>
      <button class="title-bar__btn title-bar__btn--close" title="关闭" @click="handleClose">
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Pin, Minus, Square, X } from 'lucide-vue-next'
import { useAppRuntime } from '../app/runtime'
import IconRestore from '../components/icons/IconRestore.vue'

const emit = defineEmits<{
  'close-request': []
}>()

const isAlwaysOnTop = ref(false)
const isMaximized = ref(false)
const windowService = useAppRuntime().window
const stopAlwaysOnTopListener = ref<(() => void) | null>(null)
const stopMaximizedListener = ref<(() => void) | null>(null)

const handleTogglePin = () => {
  if (windowService.isAvailable) {
    windowService.toggleAlwaysOnTop()
  }
}

const handleMinimize = () => {
  if (windowService.isAvailable) {
    windowService.minimize()
  }
}

const handleToggleMaximize = () => {
  if (windowService.isAvailable) {
    windowService.toggleMaximize()
  }
}

const handleClose = () => {
  emit('close-request')
}

onMounted(() => {
  if (windowService.isAvailable) {
    stopAlwaysOnTopListener.value = windowService.onAlwaysOnTopChanged((flag: boolean) => {
      isAlwaysOnTop.value = flag
    })
    stopMaximizedListener.value = windowService.onMaximizedChanged((flag: boolean) => {
      isMaximized.value = flag
    })
  }
})

onUnmounted(() => {
  stopAlwaysOnTopListener.value?.()
  stopMaximizedListener.value?.()
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
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: $font-sm;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: $text-secondary;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $accent-color;
    flex-shrink: 0;
    box-shadow: 0 0 6px rgba($accent-color, 0.3);
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
