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
    // 优化 #8：边界检测，防止菜单溢出窗口（140px 为菜单估算宽度，80px 为估算高度）
    const x = Math.min(e.clientX, window.innerWidth - 140)
    const y = Math.min(e.clientY, window.innerHeight - 80)
    menu.value = { visible: true, x, y, data }
  }

  const close = () => {
    menu.value.visible = false
  }

  // 点击菜单外部自动关闭
  onMounted(() => document.addEventListener('click', close))
  onBeforeUnmount(() => document.removeEventListener('click', close))

  return { menu, open, close }
}
