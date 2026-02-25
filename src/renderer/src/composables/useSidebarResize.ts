import { ref, onMounted, onBeforeUnmount } from 'vue'

const MIN_SIDEBAR_WIDTH = 100 // 左侧最小宽度
const MIN_TODO_WIDTH = 300 // 右侧最小宽度
const DEFAULT_WIDTH = 180
// 统一使用 lf-todo: 前缀（与 categoryStore、subtask.ts 保持一致的命名规范）
const STORAGE_KEY = 'lf-todo:sidebar-width'

/**
 * 侧边栏拖拽 resize composable
 * - 支持鼠标拖拽调整宽度
 * - 自动应用左/右侧最小宽度约束
 * - 持久化宽度到 localStorage
 * - 自动监听窗口 resize，保证约束始终满足
 */
export function useSidebarResize() {
  const sidebarWidth = ref(DEFAULT_WIDTH)
  const isResizing = ref(false)

  const getMaxSidebarWidth = () => window.innerWidth - MIN_TODO_WIDTH

  const applyConstraints = (width: number): number => {
    const max = getMaxSidebarWidth()
    if (width < MIN_SIDEBAR_WIDTH) return MIN_SIDEBAR_WIDTH
    if (width > max) return max
    return width
  }

  const handleWindowResize = () => {
    sidebarWidth.value = applyConstraints(sidebarWidth.value)
  }

  const handleResize = (e: MouseEvent) => {
    if (!isResizing.value) return
    sidebarWidth.value = applyConstraints(e.clientX)
  }

  const stopResize = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    localStorage.setItem(STORAGE_KEY, sidebarWidth.value.toString())
  }

  const startResize = () => {
    isResizing.value = true
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none' // 防止拖动时选中文字
  }

  onMounted(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const width = parseInt(saved)
      if (!isNaN(width)) {
        sidebarWidth.value = applyConstraints(width)
      }
    }
    window.addEventListener('resize', handleWindowResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleWindowResize)
  })

  return { sidebarWidth, startResize }
}
