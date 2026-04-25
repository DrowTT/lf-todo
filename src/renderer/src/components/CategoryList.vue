<script setup lang="ts">
import { computed, markRaw, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import { Archive, Inbox, ListTodo } from 'lucide-vue-next'
import { useAppFacade } from '../app/facade/useAppFacade'
import { useAppRuntime } from '../app/runtime'
import { useContextMenu } from '../composables/useContextMenu'
import { useTaskMoveDrag } from '../composables/useTaskMoveDrag'
import {
  ARCHIVE_TASK_VIEW_DESCRIPTION,
  ARCHIVE_TASK_VIEW_LABEL,
  INBOX_CAPTURE_DESCRIPTION,
  INBOX_CAPTURE_LABEL,
  ALL_TASKS_VIEW_DESCRIPTION,
  ALL_TASKS_VIEW_LABEL
} from '../utils/taskNavigation'

const app = useAppFacade()
const {
  categories,
  activeTaskCategoryId,
  currentMainView,
  pendingCounts,
  inboxCategory,
  isArchiveTaskViewActive,
  isAllTasksView
} = app
const { confirm } = useAppRuntime().confirm
const {
  menu: contextMenu,
  menuRef: contextMenuRef,
  open: openContextMenu,
  close: closeContextMenu,
  reposition: repositionContextMenu
} = useContextMenu<number>()
const {
  dragTaskId,
  dragSourceCategoryId,
  hoverCategoryId,
  isDraggingTask,
  setHoverCategory,
  markDropHandled
} = useTaskMoveDrag()

const newCategoryName = ref('')
const isAdding = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const editingCategoryId = ref<number | null>(null)
const editingName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const setEditInputRef = (element: Element | ComponentPublicInstance | null) => {
  editInputRef.value = element instanceof HTMLInputElement ? element : null
}

const isArchiveActive = computed(() => isArchiveTaskViewActive.value)
const systemEntryIcons = {
  all: markRaw(ListTodo),
  inbox: markRaw(Inbox),
  archive: markRaw(Archive)
}

const customCategories = computed(() => categories.value.filter((category) => !category.is_system))

const inboxEntry = computed(() => {
  const inboxId = inboxCategory.value?.id ?? null

  return {
    key: 'inbox',
    label: INBOX_CAPTURE_LABEL,
    description: INBOX_CAPTURE_DESCRIPTION,
    icon: systemEntryIcons.inbox,
    badge: inboxId === null ? 0 : (pendingCounts.value[inboxId] ?? 0),
    dropCategoryId: inboxId,
    active: currentMainView.value === 'tasks' && activeTaskCategoryId.value === inboxId,
    onClick: () => {
      if (inboxId !== null) {
        void app.selectCategory(inboxId)
      }
    }
  }
})

const systemEntries = computed(() => [
  {
    key: 'all',
    label: ALL_TASKS_VIEW_LABEL,
    description: ALL_TASKS_VIEW_DESCRIPTION,
    icon: systemEntryIcons.all,
    badge: app.allPendingCount.value,
    dropCategoryId: null,
    active: isAllTasksView.value,
    onClick: () => {
      void app.selectAllTasksView()
    }
  },
  inboxEntry.value,
  {
    key: 'archive',
    label: ARCHIVE_TASK_VIEW_LABEL,
    description: ARCHIVE_TASK_VIEW_DESCRIPTION,
    icon: systemEntryIcons.archive,
    badge: 0,
    dropCategoryId: null,
    active: isArchiveActive.value,
    onClick: () => {
      void handleSelectArchive()
    }
  }
])
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`,
  maxHeight: contextMenu.value.maxHeight === null ? undefined : `${contextMenu.value.maxHeight}px`,
  maxWidth: contextMenu.value.maxWidth === null ? undefined : `${contextMenu.value.maxWidth}px`
}))

const handleAddCategory = async () => {
  const trimmed = newCategoryName.value.trim()
  if (!trimmed) {
    cancelAddCategory()
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

const cancelAddCategory = () => {
  isAdding.value = false
  newCategoryName.value = ''
}

const handleSelectCategory = (categoryId: number) => {
  if (isDraggingTask.value) {
    return
  }

  void app.selectCategory(categoryId)
}

const handleSelectArchive = async () => {
  if (isDraggingTask.value) {
    return
  }

  if (isArchiveActive.value) {
    return
  }

  await app.selectArchivePane()
}

function handleSelectSystemEntry(onClick: () => void) {
  if (isDraggingTask.value) {
    return
  }

  onClick()
}

const handleDeleteCategory = async () => {
  if (contextMenu.value.data === null) return

  const category = categories.value.find((item) => item.id === contextMenu.value.data)
  if (!category || category.is_system) {
    closeContextMenu()
    return
  }

  const confirmed = await confirm('确认删除该分类及其所有待办吗？')
  if (confirmed) {
    await app.deleteCategory(contextMenu.value.data)
  }

  closeContextMenu()
}

const handleRenameClick = async () => {
  if (contextMenu.value.data === null) return

  const category = categories.value.find((item) => item.id === contextMenu.value.data)
  if (!category || category.is_system) {
    closeContextMenu()
    return
  }

  editingCategoryId.value = category.id
  editingName.value = category.name
  closeContextMenu()
  await nextTick()
  requestAnimationFrame(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
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

const handleCategoryContextMenu = (
  event: MouseEvent,
  category: {
    id: number
    is_system: boolean
  }
) => {
  event.preventDefault()

  if (category.is_system) {
    closeContextMenu()
    return
  }

  openContextMenu(event, category.id)
}

function canAcceptTaskDrop(categoryId: number | null): categoryId is number {
  return (
    categoryId !== null &&
    isDraggingTask.value &&
    dragTaskId.value !== null &&
    dragSourceCategoryId.value !== categoryId
  )
}

function handleTaskDragEnter(event: DragEvent, categoryId: number | null) {
  if (!canAcceptTaskDrop(categoryId)) {
    return
  }

  event.preventDefault()
  setHoverCategory(categoryId)
}

function handleTaskDragOver(event: DragEvent, categoryId: number | null) {
  if (!canAcceptTaskDrop(categoryId)) {
    return
  }

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  setHoverCategory(categoryId)
}

function handleTaskDragLeave(event: DragEvent, categoryId: number | null) {
  if (!canAcceptTaskDrop(categoryId) || hoverCategoryId.value !== categoryId) {
    return
  }

  const currentTarget = event.currentTarget
  if (!(currentTarget instanceof HTMLElement)) {
    setHoverCategory(null)
    return
  }

  const nextTarget = document.elementFromPoint(event.clientX, event.clientY)
  if (nextTarget && currentTarget.contains(nextTarget)) {
    return
  }

  setHoverCategory(null)
}

function handleTaskDrop(event: DragEvent, categoryId: number | null) {
  if (!canAcceptTaskDrop(categoryId)) {
    setHoverCategory(null)
    return
  }

  event.preventDefault()
  setHoverCategory(null)
  markDropHandled(categoryId)
}

watch(isDraggingTask, (dragging) => {
  if (!dragging) {
    setHoverCategory(null)
  }
})

watch(contextMenuRef, (element) => {
  if (element && contextMenu.value.visible) {
    repositionContextMenu()
  }
})
</script>

<template>
  <div class="category-list">
    <section class="category-list__system">
      <div class="category-section__label">视图</div>
      <ul class="category-section__list category-section__list--system">
        <li
          v-for="entry in systemEntries"
          :key="entry.key"
          class="category-item category-item--system-entry"
          :class="{
            'category-item--active': entry.active,
            'category-item--drop-target':
              entry.dropCategoryId !== null && hoverCategoryId === entry.dropCategoryId,
            'category-item--drop-disabled':
              isDraggingTask &&
              entry.dropCategoryId !== null &&
              dragSourceCategoryId === entry.dropCategoryId
          }"
          :data-category-drop-id="entry.dropCategoryId ?? undefined"
          @click="handleSelectSystemEntry(entry.onClick)"
          @dragenter="handleTaskDragEnter($event, entry.dropCategoryId)"
          @dragover="handleTaskDragOver($event, entry.dropCategoryId)"
          @dragleave="handleTaskDragLeave($event, entry.dropCategoryId)"
          @drop="handleTaskDrop($event, entry.dropCategoryId)"
        >
          <span class="category-item__icon-shell">
            <component
              :is="entry.icon"
              class="category-item__icon"
              :size="14"
              :stroke-width="2.2"
            />
          </span>
          <span class="category-item__name" :title="entry.description">{{ entry.label }}</span>
          <span v-if="entry.badge" class="category-item__badge">
            {{ entry.badge }}
          </span>
        </li>
      </ul>
    </section>

    <section class="category-list__categories">
      <div class="category-section__label">分类</div>
      <div class="category-list__categories-scroll">
        <ul class="category-section__list category-section__list--categories">
          <li
            v-for="category in customCategories"
            :key="category.id"
            class="category-item category-item--category-entry"
            :class="{
              'category-item--active':
                currentMainView === 'tasks' &&
                activeTaskCategoryId === category.id &&
                editingCategoryId !== category.id,
              'category-item--editing': editingCategoryId === category.id,
              'category-item--input-shell': editingCategoryId === category.id,
              'category-item--drop-target': hoverCategoryId === category.id,
              'category-item--drop-disabled': isDraggingTask && dragSourceCategoryId === category.id
            }"
            :data-category-drop-id="category.id"
            @click="editingCategoryId !== category.id && handleSelectCategory(category.id)"
            @contextmenu="handleCategoryContextMenu($event, category)"
            @dragenter="handleTaskDragEnter($event, category.id)"
            @dragover="handleTaskDragOver($event, category.id)"
            @dragleave="handleTaskDragLeave($event, category.id)"
            @drop="handleTaskDrop($event, category.id)"
          >
            <input
              v-if="editingCategoryId === category.id"
              :ref="setEditInputRef"
              v-model="editingName"
              class="category-item__edit-input--embedded category-item__edit-input--category-entry"
              maxlength="6"
              @keyup.enter="handleRenameConfirm"
              @keyup.escape="cancelRename"
              @blur="cancelRename"
              @click.stop
            />
            <template v-else>
              <span class="category-item__name">{{ category.name }}</span>
              <span v-if="pendingCounts[category.id]" class="category-item__badge">
                {{ pendingCounts[category.id] }}
              </span>
            </template>
          </li>

          <li v-if="!isAdding" class="category-item category-item--create" @click="startAdding">
            <span class="category-item__name category-item__name--muted">新建分类</span>
          </li>

          <li v-else class="category-item category-item--create-input">
            <input
              ref="inputRef"
              v-model="newCategoryName"
              class="category-item__edit-input--embedded"
              placeholder="输入分类名称..."
              maxlength="6"
              autofocus
              @keyup.enter="handleAddCategory"
              @keyup.escape="cancelAddCategory"
              @blur="handleAddCategory"
            />
          </li>
        </ul>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        ref="contextMenuRef"
        class="context-menu"
        :style="contextMenuStyle"
        @click.stop
      >
        <button class="context-menu__item" @click="handleRenameClick">重命名</button>
        <div class="context-menu__divider"></div>
        <button class="context-menu__item context-menu__item--danger" @click="handleDeleteCategory">
          删除分类
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.category-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
  padding: 10px 10px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: linear-gradient(180deg, #edf3f5 0%, #e8eef3 100%);
  border-right: 1px solid rgba(19, 78, 74, 0.07);
  box-sizing: border-box;

  &__system {
    flex-shrink: 0;
  }

  &__categories {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
  }

  &__categories-scroll {
    display: flex;
    flex-direction: column;
  }
}

.category-section {
  &__label {
    margin: 8px 10px 5px;
    font-size: 11px;
    font-weight: 700;
    color: rgba(71, 85, 105, 0.72);
    letter-spacing: 0.08em;
  }

  &__list {
    margin: 0;
    padding: 6px;
    list-style: none;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.34);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.58),
      0 8px 18px rgba(148, 163, 184, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-sizing: border-box;

    &--system {
      padding: 4px 6px;
    }

    &--categories {
      padding-bottom: 8px;
    }
  }
}

.category-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 10px 16px;
  margin: 0;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: $text-secondary;
  font-size: $font-sm;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  & + & {
    margin-top: 4px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.74);
    color: $text-primary;
  }

  &--active {
    background: rgba(255, 255, 255, 0.94);
    color: $text-primary;
    box-shadow:
      inset 0 0 0 1px rgba(19, 78, 74, 0.06),
      0 10px 22px rgba(148, 163, 184, 0.12);

    &::before {
      content: '';
      position: absolute;
      left: 11.5px;
      top: 50%;
      width: 6px;
      height: 6px;
      background: $accent-color;
      border-radius: 50%;
      transform: translateY(-50%);
    }
  }

  &--system-entry .category-item__name {
    padding-left: 10px;
    font-weight: 600;
  }

  &--system-entry {
    min-height: 40px;
    padding: 10px 16px;
    border-radius: 14px;
    gap: 0;

    &.category-item--active::before {
      content: none;
    }

    &.category-item--active .category-item__icon-shell {
      background: $accent-soft;
      color: $accent-color;
    }
  }

  &--category-entry .category-item__name {
    padding-left: 13px;
    padding-top: 2px;
    line-height: 18px;
  }

  &--create,
  &--create-input,
  &--input-shell {
    padding-top: 9px;
    padding-bottom: 9px;
  }

  &--create {
    justify-content: center;
    border: 1px dashed rgba($border-light, 0.95);
    background: rgba(255, 255, 255, 0.3);

    .category-item__name {
      flex: 0 1 auto;
      padding-left: 0;
      text-align: center;
    }

    &:hover {
      border-color: rgba($accent-color, 0.4);
      background: rgba(255, 255, 255, 0.62);
      box-shadow: none;
    }
  }

  &--create-input,
  &--input-shell {
    border: 1px solid rgba($accent-color, 0.14);
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 10px 22px rgba(148, 163, 184, 0.1);
    cursor: text;

    &::before {
      content: '';
      position: absolute;
      left: 10.75px;
      top: 50%;
      width: 6px;
      height: 6px;
      background: rgba($accent-color, 0.28);
      border-radius: 50%;
      transform: translateY(-50%);
    }

    &:hover {
      background: rgba(255, 255, 255, 0.94);
      color: $text-primary;
    }

    &:focus-within {
      border-color: rgba($accent-color, 0.18);
      box-shadow:
        0 0 0 3px rgba($accent-color, 0.08),
        0 10px 22px rgba(148, 163, 184, 0.1);
    }
  }

  &--editing {
    cursor: text;
  }

  &--drop-target {
    background: rgba($accent-color, 0.12);
    color: $text-primary;
    box-shadow:
      inset 0 0 0 1px rgba($accent-color, 0.18),
      0 10px 22px rgba(37, 99, 235, 0.1);
  }

  &--drop-disabled {
    opacity: 0.74;
  }

  &__icon-shell {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 7px;
    background: rgba(37, 99, 235, 0.08);
    color: rgba(37, 99, 235, 0.78);
  }

  &__icon {
    display: block;
  }

  &__name {
    flex: 1;
    min-width: 0;
    display: block;
    box-sizing: border-box;
    padding-left: 12px;
    padding-top: 1px;
    line-height: 19px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--muted {
      color: $text-muted;
    }
  }

  &__badge {
    display: inline-flex;
    min-width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0 6px;
    margin-left: $spacing-sm;
    border-radius: 10px;
    background: $accent-soft;
    color: $accent-color;
    font-size: $font-xs;
    font-weight: 600;
    line-height: 1;
    align-self: center;
  }

  &__edit-input {
    width: 100%;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $border-light;
    border-radius: $radius-md;
    background: $bg-input;
    color: $text-primary;
    font-size: $font-sm;
    font-family: inherit;
    outline: none;

    &:focus {
      border-color: $accent-color;
      box-shadow: 0 0 0 3px $accent-soft;
    }

    &--embedded {
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 20px;
      padding: 0 0 1px 12px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: $text-primary;
      font-size: inherit;
      font-family: inherit;
      font-weight: inherit;
      box-shadow: none;
      line-height: 19px;
      appearance: none;
      outline: none;

      &::placeholder {
        color: $text-muted;
        opacity: 1;
      }

      &:focus {
        border-color: transparent;
        box-shadow: none;
      }
    }

    &--category-entry {
      padding: 1px 0 1px 12px;
      line-height: 18px;
    }
  }
}

.context-menu {
  position: fixed;
  z-index: $z-context-menu;
  min-width: 140px;
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

  &__item {
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
    margin: $spacing-xs 0;
    background: $border-subtle;
  }
}
</style>
