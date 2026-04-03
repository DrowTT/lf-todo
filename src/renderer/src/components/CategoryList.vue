<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Clock3, Plus, Settings } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { useContextMenu } from '../composables/useContextMenu'
import { useAppSessionStore } from '../store/appSession'
import { usePomodoroStore } from '../store/pomodoro'

const emit = defineEmits<{
  'open-settings': []
}>()

const app = useAppFacade()
const { categories, currentCategoryId, pendingCounts } = app
const { confirm } = useAppRuntime().confirm
const appSessionStore = useAppSessionStore()
const {
  menu: contextMenu,
  open: openContextMenu,
  close: closeContextMenu
} = useContextMenu<number>()
const pomodoroStore = usePomodoroStore()
const { isRunning: isPomodoroRunning, formattedRemaining } = storeToRefs(pomodoroStore)

const newCategoryName = ref('')
const isAdding = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const editingCategoryId = ref<number | null>(null)
const editingName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

const handleAddCategory = async () => {
  const trimmed = newCategoryName.value.trim()
  if (!trimmed) {
    isAdding.value = false
    return
  }

  await app.addCategory(trimmed)
  newCategoryName.value = ''
  isAdding.value = false
}

const startAdding = async () => {
  isAdding.value = true
  await nextTick()
  inputRef.value?.focus()
}

const openPomodoroView = () => {
  appSessionStore.currentMainView = 'pomodoro'
}

const handleSelectCategory = (categoryId: number) => {
  appSessionStore.currentMainView = 'tasks'
  void app.selectCategory(categoryId)
}

const handleDeleteCategory = async () => {
  if (contextMenu.value.data === null) return

  const confirmed = await confirm('确认删除该分类及其所有待办吗？')
  if (confirmed) {
    await app.deleteCategory(contextMenu.value.data)
  }

  closeContextMenu()
}

const handleRenameClick = async () => {
  if (contextMenu.value.data === null) return

  const category = categories.value.find((item) => item.id === contextMenu.value.data)
  if (!category) return

  editingCategoryId.value = category.id
  editingName.value = category.name
  closeContextMenu()
  await nextTick()
  editInputRef.value?.focus()
}

const handleRenameConfirm = async () => {
  if (editingCategoryId.value !== null && editingName.value.trim()) {
    await app.updateCategory(editingCategoryId.value, editingName.value.trim())
  }

  cancelRename()
}

const cancelRename = () => {
  editingCategoryId.value = null
  editingName.value = ''
}
</script>

<template>
  <div class="category-list">
    <div class="category-list__header">
      <div class="category-list__view-switch">
        <button
          class="category-list__view-btn"
          :class="{
            'category-list__view-btn--active': appSessionStore.currentMainView === 'pomodoro',
            'category-list__view-btn--running': isPomodoroRunning
          }"
          @click="openPomodoroView"
        >
          <Clock3 v-if="!isPomodoroRunning" :size="14" />
          <!-- 空闲时显示"番茄钟"，运行时显示脉冲点+倒计时 -->
          <template v-if="!isPomodoroRunning">
            <span>番茄钟</span>
          </template>
          <template v-else>
            <span class="category-list__pomo-inline">
              <span class="category-list__pomo-dot" />
              <span class="category-list__pomo-time">{{ formattedRemaining }}</span>
            </span>
          </template>
        </button>
      </div>
      <span class="category-list__header-label">分类</span>
    </div>

    <div class="category-list__content">
      <ul>
        <li
          v-for="category in categories"
          :key="category.id"
          class="category-item"
          :class="{
            'category-item--active':
              appSessionStore.currentMainView === 'tasks' && currentCategoryId === category.id,
            'category-item--editing': editingCategoryId === category.id
          }"
          @click="editingCategoryId !== category.id && handleSelectCategory(category.id)"
          @contextmenu="openContextMenu($event, category.id)"
        >
          <input
            v-if="editingCategoryId === category.id"
            ref="editInputRef"
            v-model="editingName"
            class="category-item__edit-input"
            maxlength="6"
            @keyup.enter="handleRenameConfirm"
            @keyup.escape="cancelRename"
            @blur="handleRenameConfirm"
            @click.stop
          />
          <template v-else>
            <span class="category-item__name">{{ category.name }}</span>
            <span v-if="pendingCounts[category.id]" class="category-item__badge">
              {{ pendingCounts[category.id] }}
            </span>
          </template>
        </li>
      </ul>

      <div v-if="isAdding" class="category-list__input-wrapper">
        <input
          ref="inputRef"
          v-model="newCategoryName"
          class="category-list__input"
          placeholder="输入名称..."
          maxlength="6"
          autofocus
          @keyup.enter="handleAddCategory"
          @blur="handleAddCategory"
        />
      </div>
    </div>

    <div class="category-list__footer">
      <button v-if="!isAdding" class="category-list__add-btn" @click="startAdding">
        <Plus class="category-list__add-icon" :size="12" />
        新建分类
      </button>
      <div class="category-list__footer-divider"></div>
      <button class="category-list__settings-btn" @click="emit('open-settings')">
        <Settings :size="14" />
        <span>设置</span>
      </button>
    </div>

    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <button class="context-menu__item" @click="handleRenameClick">重命名</button>
      <div class="context-menu__divider"></div>
      <button class="context-menu__item context-menu__item--danger" @click="handleDeleteCategory">
        删除分类
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.category-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #edf3f5 0%, #e8eef3 100%);
  border-right: 1px solid rgba(19, 78, 74, 0.07);

  &__header {
    padding: 22px 18px 10px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  &__view-switch {
    display: flex;
  }

  &__view-btn {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    min-height: 42px;
    width: 100%;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.52);
    background: rgba(255, 255, 255, 0.38);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: $text-secondary;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    transition:
      background-color $transition-normal,
      border-color $transition-normal,
      color $transition-normal,
      box-shadow $transition-normal;

    &:hover {
      color: $accent-color;
      border-color: rgba(37, 99, 235, 0.16);
      background: rgba(255, 255, 255, 0.62);
      box-shadow: 0 8px 14px rgba(15, 23, 42, 0.03);
    }

    /* 图标不要被压缩，并修正基线对齐 */
    > svg {
      flex-shrink: 0;
      margin-top: -1px;
    }
  }

  &__view-btn--active {
    color: $accent-color;
    border-color: rgba(37, 99, 235, 0.14);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.04);
  }

  /* 运行态包裹容器：让脉冲点+时间作为整体居中 */
  &__pomo-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* 运行态脉冲点：紧贴倒计时文字左侧 */
  &__pomo-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #16a34a;
    flex-shrink: 0;
    animation: sidebar-pomo-pulse 1.8s ease-in-out infinite;
  }

  /* 倒计时文本：固定宽度防止数字变化导致抖动 */
  &__pomo-time {
    display: inline-block;
    min-width: 42px;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: $accent-color;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  /* 运行态按钮微调：内容居中 */
  &__view-btn--running {
    justify-content: center;
    border-color: rgba(37, 99, 235, 0.18);
    background: rgba(255, 255, 255, 0.82);
  }

  &__header-label {
    font-size: 11px;
    font-weight: 600;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-xs 0;
  }

  &__footer {
    padding: 10px 14px 10px;
  }

  &__footer-divider {
    height: 1px;
    background: rgba(15, 23, 42, 0.06);
    margin: 10px -14px;
  }

  &__settings-btn {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    background: transparent;
    border: none;
    border-radius: 12px;
    font-size: $font-sm;
    color: $text-muted;
    cursor: pointer;
    transition: all $transition-normal;

    &:hover {
      color: $accent-color;
      background: $accent-soft;
    }
  }

  &__add-btn {
    display: flex;
    align-items: center;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    background: transparent;
    border: 1px dashed $border-light;
    border-radius: 12px;
    font-size: $font-sm;
    color: $text-muted;
    cursor: pointer;
    transition: all $transition-normal;

    &:hover {
      color: $accent-color;
      border-color: $accent-color;
      background: $accent-soft;
    }
  }

  &__add-icon {
    width: 12px;
    height: 12px;
    margin-right: $spacing-sm;
  }

  &__input-wrapper {
    padding: $spacing-xs $spacing-md;
  }

  &__input {
    width: 100%;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-sm;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $border-light;
    border-radius: $radius-md;
    outline: none;
    transition: all $transition-fast;

    &:focus {
      border-color: $accent-color;
      box-shadow: 0 0 0 3px $accent-soft;
    }

    &::placeholder {
      color: $text-muted;
    }
  }
}

.category-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  margin: 2px 10px;
  font-size: $font-sm;
  color: $text-secondary;
  cursor: pointer;
  border-radius: 14px;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
  position: relative;

  &:hover {
    background: rgba(255, 255, 255, 0.72);
    color: $text-primary;
    box-shadow: 0 8px 14px rgba(15, 23, 42, 0.03);
  }

  &--active {
    background: rgba(255, 255, 255, 0.92);
    color: $text-primary;
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.04);

    &::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 50%;
      width: 6px;
      height: 6px;
      background: $accent-color;
      border-radius: 50%;
      transform: translateY(-50%);
    }
  }

  &__name {
    flex: 1;
    padding-left: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__badge {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    margin-left: $spacing-sm;
    font-size: $font-xs;
    font-weight: 600;
    line-height: 20px;
    text-align: center;
    color: $accent-color;
    background: $accent-soft;
    border-radius: 10px;
  }

  &--editing {
    padding: $spacing-xs $spacing-md;
    margin: 0;
  }

  &__edit-input {
    width: 100%;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-sm;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $border-light;
    border-radius: $radius-md;
    outline: none;
    font-family: inherit;
    transition: all $transition-fast;

    &:focus {
      border-color: $accent-color;
      box-shadow: 0 0 0 3px $accent-soft;
    }
  }
}

.context-menu {
  position: fixed;
  z-index: 1000;
  background: $glass-bg;
  backdrop-filter: $glass-blur;
  -webkit-backdrop-filter: $glass-blur;
  border: $glass-border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  padding: $spacing-xs;
  min-width: 140px;

  &__item {
    display: block;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    background: transparent;
    border: none;
    border-radius: $radius-sm;
    text-align: left;
    font-size: $font-sm;
    color: $text-primary;
    cursor: pointer;
    transition: background-color $transition-fast;

    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    &--danger {
      color: $danger-color;

      &:hover {
        background: rgba($danger-color, 0.1);
      }
    }
  }

  &__divider {
    height: 1px;
    background: $border-subtle;
    margin: $spacing-xs 0;
  }
}

/* 番茄钟运行状态脉冲动画 */
@keyframes sidebar-pomo-pulse {
  0%, 100% {
    opacity: 0.4;
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.3);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0);
  }
}
</style>
