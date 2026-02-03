<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { store } from '../store'
import { useConfirm } from '../composables/useConfirm'

const { confirm } = useConfirm()

const newCategoryName = ref('')
const isAdding = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  categoryId: null as number | null
})

// 重命名状态
const editingCategoryId = ref<number | null>(null)
const editingName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  store.fetchCategories()
  // 点击其他地方关闭右键菜单
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})

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

const handleContextMenu = (e: MouseEvent, id: number) => {
  e.preventDefault()
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    categoryId: id
  }
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
}

const handleDeleteCategory = async () => {
  if (contextMenu.value.categoryId === null) return
  const confirmed = await confirm('确认删除该分类及其所有待办吗?')
  if (confirmed) {
    await store.deleteCategory(contextMenu.value.categoryId)
  }
  closeContextMenu()
}

const handleRenameClick = async () => {
  if (contextMenu.value.categoryId === null) return
  const category = store.categories.find((c) => c.id === contextMenu.value.categoryId)
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
    <div class="category-list__header">分类</div>

    <div class="category-list__content">
      <ul>
        <li
          v-for="cat in store.categories"
          :key="cat.id"
          class="category-item"
          :class="{ 'category-item--active': store.currentCategoryId === cat.id }"
          @click="store.selectCategory(cat.id)"
          @contextmenu="handleContextMenu($event, cat.id)"
        >
          <input
            v-if="editingCategoryId === cat.id"
            v-model="editingName"
            class="category-list__input category-list__input--inline"
            @keyup.enter="handleRenameConfirm"
            @blur="handleRenameConfirm"
            @click.stop
            ref="editInputRef"
          />
          <span v-else class="category-item__name">{{ cat.name }}</span>
        </li>
      </ul>

      <div v-if="isAdding" class="category-list__input-wrapper">
        <input
          v-model="newCategoryName"
          class="category-list__input"
          placeholder="输入名称..."
          @keyup.enter="handleAddCategory"
          @blur="handleAddCategory"
          ref="inputRef"
          autofocus
        />
      </div>
    </div>

    <div class="category-list__footer">
      <button v-if="!isAdding" @click="startAdding" class="category-list__add-btn">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="category-list__add-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
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
      <button @click="handleRenameClick" class="context-menu__item">重命名</button>
      <div class="context-menu__divider"></div>
      <button @click="handleDeleteCategory" class="context-menu__item context-menu__item--danger">
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
  width: 180px;
  background: $bg-secondary;
  border-right: 1px solid $border-color;

  &__header {
    padding: $spacing-md;
    font-size: $font-xs;
    font-weight: 600;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__content {
    flex: 1;
    overflow-y: auto;
  }

  &__footer {
    padding: $spacing-sm;
    border-top: 1px solid $border-color;
  }

  &__add-btn {
    display: flex;
    align-items: center;
    width: 100%;
    padding: $spacing-sm;
    background: transparent;
    border: none;
    font-size: $font-sm;
    color: $text-secondary;
    cursor: pointer;
    transition: color $transition-fast;

    &:hover {
      color: $text-primary;
    }
  }

  &__add-icon {
    width: 12px;
    height: 12px;
    margin-right: $spacing-xs;
  }

  &__input-wrapper {
    padding: 0 $spacing-sm $spacing-xs;
  }

  &__input {
    width: 100%;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-sm;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    outline: none;
    transition: border-color $transition-fast;

    &:focus {
      border-color: $accent-color;
    }

    &::placeholder {
      color: $text-muted;
    }

    &--inline {
      padding: 0 $spacing-xs;
      height: 20px;
      font-size: $font-sm;
    }
  }
}

.category-item {
  padding: $spacing-sm $spacing-md;
  font-size: $font-sm;
  color: $text-secondary;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    background: $bg-hover;
    color: $text-primary;
  }

  &--active {
    background: $bg-hover;
    color: $text-primary;
    border-left: 2px solid $accent-color;
  }

  &__name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.context-menu {
  position: fixed;
  z-index: 1000;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: $spacing-xs 0;
  min-width: 120px;

  &__item {
    display: block;
    width: 100%;
    padding: $spacing-sm $spacing-md;
    background: transparent;
    border: none;
    text-align: left;
    font-size: $font-sm;
    color: $text-primary;
    cursor: pointer;
    transition: background-color $transition-fast;

    &:hover {
      background: $bg-hover;
      color: $text-primary;
    }

    &--danger {
      &:hover {
        background: $bg-hover;
        color: $danger-color;
      }
    }
  }

  &__divider {
    height: 1px;
    background: $border-color;
    margin: $spacing-xs 0;
  }
}
</style>
