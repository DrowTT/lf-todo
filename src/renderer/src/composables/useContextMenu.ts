import { ref, onMounted, onBeforeUnmount } from 'vue'

interface MenuState<T> {
  visible: boolean
  x: number
  y: number
  data: T | null
}

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
    data: null
  })

  const open = (e: MouseEvent, data: T) => {
    e.preventDefault()
    menu.value = { visible: true, x: e.clientX, y: e.clientY, data }
  }

  const close = () => {
    menu.value.visible = false
  }

  // 点击菜单外部自动关闭
  onMounted(() => document.addEventListener('click', close))
  onBeforeUnmount(() => document.removeEventListener('click', close))

  return { menu, open, close }
}
