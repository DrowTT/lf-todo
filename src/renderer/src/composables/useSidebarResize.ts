import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ACTIVITY_BAR_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MIN_TODO_WIDTH
} from '../../../shared/constants/layout'

const STORAGE_KEY = 'lf-todo:sidebar-width'

export function useSidebarResize() {
  const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH)
  const isResizing = ref(false)

  const getMaxSidebarWidth = () => window.innerWidth - MIN_TODO_WIDTH - ACTIVITY_BAR_WIDTH

  const applyConstraints = (width: number): number => {
    const max = getMaxSidebarWidth()
    if (max < MIN_SIDEBAR_WIDTH) return Math.max(0, max)
    if (width < MIN_SIDEBAR_WIDTH) return MIN_SIDEBAR_WIDTH
    if (width > max) return max
    return width
  }

  const handleWindowResize = () => {
    sidebarWidth.value = applyConstraints(sidebarWidth.value)
  }

  const handleResize = (event: MouseEvent) => {
    if (!isResizing.value) return
    sidebarWidth.value = applyConstraints(event.clientX - ACTIVITY_BAR_WIDTH)
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
    document.body.style.userSelect = 'none'
  }

  onMounted(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const width = parseInt(saved, 10)
      if (!Number.isNaN(width)) {
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
