<script setup lang="ts">
import { ref, watch } from 'vue'

interface MoveTarget {
  id: number
  label: string
}

defineProps<{
  visible: boolean
  targets: MoveTarget[]
  menuStyle: Record<string, string | undefined>
}>()

const emit = defineEmits<{
  move: [targetCategoryId: number]
  'update:menuRef': [element: HTMLElement | null]
}>()

const menuElement = ref<HTMLElement | null>(null)

watch(
  menuElement,
  (element) => {
    emit('update:menuRef', element)
  },
  { flush: 'post' }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuElement"
      class="task-move-menu"
      :style="menuStyle"
      @click.stop
    >
      <div class="task-move-menu__label">移动到</div>
      <button
        v-for="target in targets"
        :key="target.id"
        class="task-move-menu__item"
        @click="emit('move', target.id)"
      >
        {{ target.label }}
      </button>
      <div v-if="targets.length === 0" class="task-move-menu__empty">没有可移动的分类</div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.task-move-menu {
  position: fixed;
  z-index: $z-context-menu;
  min-width: 168px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  padding: $spacing-xs;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  border: $glass-border;
  border-radius: $radius-lg;
  background: $glass-bg;
  backdrop-filter: $glass-blur;
  -webkit-backdrop-filter: $glass-blur;
  box-shadow: $shadow-popover;
}

.task-move-menu__label {
  position: sticky;
  top: 0;
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 700;
  background: $glass-bg;
  color: $text-muted;
  letter-spacing: 0.04em;
}

.task-move-menu__item {
  display: block;
  width: 100%;
  padding: $spacing-sm $spacing-md;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-primary;
  font-size: $font-sm;
  text-align: left;
  cursor: pointer;
  transition:
    background-color $transition-fast,
    color $transition-fast;

  &:hover {
    background: rgba($accent-color, 0.08);
    color: $accent-color;
  }
}

.task-move-menu__empty {
  padding: $spacing-sm $spacing-md;
  color: $text-muted;
  font-size: $font-sm;
}
</style>
