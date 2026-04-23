import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

interface MenuState<T> {
  visible: boolean
  x: number
  y: number
  maxHeight: number | null
  maxWidth: number | null
  data: T | null
}

const VIEWPORT_PADDING = 12

/**
 * 通用右键菜单 composable
 * - 自动管理 document click 监听以关闭菜单
 * - 泛型 data 字段承载菜单关联的业务数据（如 categoryId）
 */
export function useContextMenu<T = number>() {
  const menu = ref<MenuState<T>>({
    visible: false,
    x: 0,
    y: 0,
    maxHeight: null,
    maxWidth: null,
    data: null
  })
  const menuRef = ref<HTMLElement | null>(null)
  const anchorX = ref(0)
  const anchorY = ref(0)

  const reposition = () => {
    if (!menu.value.visible) {
      return
    }

    const element = menuRef.value
    if (!element) {
      return
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const rect = element.getBoundingClientRect()

    const availableLeft = Math.max(0, anchorX.value - VIEWPORT_PADDING)
    const availableRight = Math.max(0, viewportWidth - anchorX.value - VIEWPORT_PADDING)
    const availableAbove = Math.max(0, anchorY.value - VIEWPORT_PADDING)
    const availableBelow = Math.max(0, viewportHeight - anchorY.value - VIEWPORT_PADDING)

    const viewportMaxWidth = Math.max(0, viewportWidth - VIEWPORT_PADDING * 2)
    const viewportMaxHeight = Math.max(0, viewportHeight - VIEWPORT_PADDING * 2)

    let nextX = anchorX.value
    let nextY = anchorY.value
    let nextMaxWidth: number | null = null
    let nextMaxHeight: number | null = null

    if (rect.width > availableRight && availableLeft > availableRight) {
      nextX = anchorX.value - rect.width
    }

    if (rect.width > viewportMaxWidth) {
      nextX = VIEWPORT_PADDING
      nextMaxWidth = viewportMaxWidth
    } else {
      nextX = Math.min(
        Math.max(VIEWPORT_PADDING, nextX),
        Math.max(VIEWPORT_PADDING, viewportWidth - rect.width - VIEWPORT_PADDING)
      )
    }

    if (rect.height <= availableBelow) {
      nextY = anchorY.value
    } else if (rect.height <= availableAbove) {
      nextY = anchorY.value - rect.height
    } else if (availableBelow >= availableAbove) {
      nextY = anchorY.value
      nextMaxHeight = availableBelow
    } else {
      nextMaxHeight = availableAbove
      nextY = anchorY.value - availableAbove
    }

    if (rect.height > viewportMaxHeight) {
      nextY = VIEWPORT_PADDING
      nextMaxHeight = viewportMaxHeight
    } else {
      nextY = Math.min(
        Math.max(VIEWPORT_PADDING, nextY),
        Math.max(VIEWPORT_PADDING, viewportHeight - rect.height - VIEWPORT_PADDING)
      )
    }

    menu.value = {
      ...menu.value,
      x: nextX,
      y: nextY,
      maxHeight: nextMaxHeight,
      maxWidth: nextMaxWidth
    }
  }

  const open = (e: MouseEvent, data: T) => {
    e.preventDefault()

    anchorX.value = e.clientX
    anchorY.value = e.clientY
    menu.value = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
      maxHeight: null,
      maxWidth: null,
      data
    }

    void nextTick(() => {
      reposition()
    })
  }

  const close = () => {
    menu.value = {
      ...menu.value,
      visible: false,
      maxHeight: null,
      maxWidth: null,
      data: null
    }
  }

  const handleWindowResize = () => {
    if (!menu.value.visible) {
      return
    }

    void nextTick(() => {
      reposition()
    })
  }

  // 点击菜单外部自动关闭
  onMounted(() => document.addEventListener('click', close))
  onMounted(() => window.addEventListener('resize', handleWindowResize))
  onBeforeUnmount(() => document.removeEventListener('click', close))
  onBeforeUnmount(() => window.removeEventListener('resize', handleWindowResize))

  return { menu, menuRef, open, close, reposition }
}
