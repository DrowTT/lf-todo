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
        class="title-bar__search"
        :title="`全局搜索（${globalSearchShortcutLabel}）`"
        @click="handleOpenGlobalSearch"
      >
        <Search :size="14" />
        <span class="title-bar__search-text">搜索</span>
        <span class="title-bar__search-key">{{ globalSearchShortcutLabel }}</span>
      </button>
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
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Minus, Pin, Search, Square, X } from 'lucide-vue-next'
import { useAppRuntime } from '../app/runtime'
import IconRestore from '../components/icons/IconRestore.vue'
import { useHotkeys } from '../composables/useHotkeys'
import { useGlobalSearchStore } from '../store/globalSearch'

const emit = defineEmits<{
  'close-request': []
}>()

const isAlwaysOnTop = ref(false)
const isMaximized = ref(false)
const windowService = useAppRuntime().window
const { hotkeyConfig } = useHotkeys()
const globalSearchStore = useGlobalSearchStore()
const stopAlwaysOnTopListener = ref<(() => void) | null>(null)
const stopMaximizedListener = ref<(() => void) | null>(null)
const globalSearchShortcutLabel = computed(() => hotkeyConfig.openGlobalSearch.label)

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

const handleOpenGlobalSearch = () => {
  globalSearchStore.open({
    scope: 'all'
  })
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
}

.title-bar__drag-area {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding-left: $spacing-lg;
  -webkit-app-region: drag;
}

.title-bar__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-sm;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: $text-secondary;
}

.title-bar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $accent-color;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba($accent-color, 0.3);
}

.title-bar__controls {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.title-bar__search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  margin-right: 6px;
  padding: 0 12px;
  border: 1px solid rgba($border-light, 0.7);
  border-radius: 999px;
  background: rgba($bg-elevated, 0.84);
  color: $text-secondary;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: rgba($accent-color, 0.24);
    color: $text-primary;
  }
}

.title-bar__search-text {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  line-height: 1;
}

.title-bar__search-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba($bg-deep, 0.84);
  color: $text-muted;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.title-bar__btn {
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
}

.title-bar__btn--pin {
  &.is-active {
    background: $accent-soft;
    color: $accent-color;
  }

  &:hover {
    background: $accent-soft;
    color: $accent-color;
  }
}

.title-bar__btn--close {
  &:hover {
    background: $danger-color;
    color: white;
  }
}
</style>
