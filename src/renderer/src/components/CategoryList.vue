<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'
import { useContextMenu } from '../composables/useContextMenu'
import { Plus } from 'lucide-vue-next'

const { confirm } = useConfirm()
const {
  menu: contextMenu,
  open: openContextMenu,
  close: closeContextMenu
} = useContextMenu<number>()

onMounted(() => store.fetchCategories())

const newCategoryName = ref('')
const isAdding = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// 重命名状态
const editingCategoryId = ref<number | null>(null)
const editingName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

const handleAddCategory = async () => {
  if (!newCategoryName.value.trim()) {
    isAdding.value = false
    return
  }
  await store.addCategory(newCategoryName.value.trim())
  newCategoryName.value = ''
  isAdding.value = false
}

const startAdding = async () => {
  isAdding.value = true
  await nextTick()
  inputRef.value?.focus()
}

const handleDeleteCategory = async () => {
  if (contextMenu.value.data === null) return
  const confirmed = await confirm('确认删除该分类及其所有待办吗?')
  if (confirmed) {
    await store.deleteCategory(contextMenu.value.data)
  }
  closeContextMenu()
}

const handleRenameClick = async () => {
  if (contextMenu.value.data === null) return
  const category = store.categories.find((c) => c.id === contextMenu.value.data)
  if (category) {
    editingCategoryId.value = category.id
    editingName.value = category.name
    closeContextMenu()
    await nextTick()
    editInputRef.value?.focus()
  }
}

const handleRenameConfirm = async () => {
  if (editingCategoryId.value !== null && editingName.value.trim()) {
    await store.updateCategory(editingCategoryId.value, editingName.value.trim())
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
      <span class="category-list__header-label">分类</span>
    </div>

    <div class="category-list__content">
      <ul>
        <li
          v-for="cat in store.categories"
          :key="cat.id"
          class="category-item"
          :class="{
            'category-item--active': store.currentCategoryId === cat.id,
            'category-item--editing': editingCategoryId === cat.id
          }"
          @click="editingCategoryId !== cat.id && store.selectCategory(cat.id)"
          @contextmenu="openContextMenu($event, cat.id)"
        >
          <input
            v-if="editingCategoryId === cat.id"
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
            <span class="category-item__name">{{ cat.name }}</span>
            <span v-if="store.pendingCounts[cat.id]" class="category-item__badge">
              {{ store.pendingCounts[cat.id] }}
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
    </div>

    <!-- 右键菜单 -->
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
  background: $bg-sidebar;
  border-right: 1px solid $border-subtle;

  &__header {
    padding: $spacing-lg $spacing-lg $spacing-sm;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__header-label {
    font-size: $font-xs;
    font-weight: 600;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-xs 0;
  }

  &__footer {
    padding: $spacing-sm $spacing-md;
    border-top: 1px solid $border-subtle;
  }

  &__add-btn {
    display: flex;
    align-items: center;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    background: transparent;
    border: 1px dashed $border-light;
    border-radius: $radius-md;
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
  padding: $spacing-sm $spacing-lg;
  margin: 0 $spacing-sm;
  font-size: $font-sm;
  color: $text-secondary;
  cursor: pointer;
  border-radius: $radius-md;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
  position: relative;

  &:hover {
    background: $accent-soft;
    color: $text-primary;
  }

  &--active {
    background: $accent-soft;
    color: $text-primary;

    // 左侧 accent 指示条
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      bottom: 20%;
      width: 3px;
      background: $accent-color;
      border-radius: 0 2px 2px 0;
    }
  }

  &__name {
    flex: 1;
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

  // inline 重命名输入框 — 与新建分类输入框样式一致
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
</style>
