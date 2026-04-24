import { onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useTaskMoveDrag } from './useTaskMoveDrag'

const EDGE_THRESHOLD = 72
const MIN_SCROLL_STEP = 6
const MAX_SCROLL_STEP = 24

function isScrollableY(element: HTMLElement): boolean {
  if (element.scrollHeight <= element.clientHeight) {
    return false
  }

  const { overflowY } = window.getComputedStyle(element)
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

function findScrollableAncestor(start: Element | null): HTMLElement | null {
  let current = start instanceof HTMLElement ? start : (start?.parentElement ?? null)

  while (current) {
    if (isScrollableY(current)) {
      return current
    }

    current = current.parentElement
  }

  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolveScrollStep(distance: number): number {
  const ratio = 1 - distance / EDGE_THRESHOLD
  return Math.round(MIN_SCROLL_STEP + (MAX_SCROLL_STEP - MIN_SCROLL_STEP) * ratio)
}

export function useTaskDragAutoScroll() {
  const { isDraggingTask } = useTaskMoveDrag()
  const lastPointerX = shallowRef<number | null>(null)
  const lastPointerY = shallowRef<number | null>(null)
  const activeScrollContainer = shallowRef<HTMLElement | null>(null)
  const rafId = shallowRef<number | null>(null)

  function updatePointer(clientX: number, clientY: number) {
    if (clientX < 0 || clientY < 0) {
      return
    }

    lastPointerX.value = clientX
    lastPointerY.value = clientY
  }

  function rememberScrollContainer(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return
    }

    const container = findScrollableAncestor(target)
    if (container) {
      activeScrollContainer.value = container
    }
  }

  function resolveScrollContainer(): HTMLElement | null {
    const pointerX = lastPointerX.value
    const pointerY = lastPointerY.value

    if (pointerX !== null && pointerY !== null) {
      const pointedElement = document.elementFromPoint(pointerX, pointerY)
      const pointedContainer = findScrollableAncestor(pointedElement)
      if (pointedContainer) {
        activeScrollContainer.value = pointedContainer
        return pointedContainer
      }
    }

    return activeScrollContainer.value
  }

  function resetAutoScrollState() {
    lastPointerX.value = null
    lastPointerY.value = null
    activeScrollContainer.value = null
  }

  function stopLoop() {
    if (rafId.value !== null) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
  }

  function tick() {
    if (!isDraggingTask.value) {
      stopLoop()
      return
    }

    const pointerX = lastPointerX.value
    const pointerY = lastPointerY.value
    const container = resolveScrollContainer()

    if (pointerX !== null && pointerY !== null && container) {
      const rect = container.getBoundingClientRect()
      const isWithinHorizontalBounds = pointerX >= rect.left && pointerX <= rect.right

      if (isWithinHorizontalBounds) {
        let delta = 0

        if (pointerY >= rect.top && pointerY <= rect.top + EDGE_THRESHOLD) {
          delta = -resolveScrollStep(pointerY - rect.top)
        } else if (pointerY <= rect.bottom && pointerY >= rect.bottom - EDGE_THRESHOLD) {
          delta = resolveScrollStep(rect.bottom - pointerY)
        }

        if (delta !== 0) {
          const maxScrollTop = container.scrollHeight - container.clientHeight
          if (maxScrollTop > 0) {
            container.scrollTop = clamp(container.scrollTop + delta, 0, maxScrollTop)
          }
        }
      }
    }

    rafId.value = requestAnimationFrame(tick)
  }

  function startLoop() {
    if (rafId.value !== null) {
      return
    }

    rafId.value = requestAnimationFrame(tick)
  }

  function handleDocumentDragOver(event: DragEvent) {
    if (!isDraggingTask.value) {
      return
    }

    updatePointer(event.clientX, event.clientY)
    rememberScrollContainer(event.target)
  }

  watch(isDraggingTask, (dragging) => {
    if (dragging) {
      startLoop()
      return
    }

    stopLoop()
    resetAutoScrollState()
  })

  onMounted(() => {
    document.addEventListener('dragover', handleDocumentDragOver, true)
    document.addEventListener('drop', resetAutoScrollState, true)
    document.addEventListener('dragend', resetAutoScrollState, true)
  })

  onUnmounted(() => {
    stopLoop()
    document.removeEventListener('dragover', handleDocumentDragOver, true)
    document.removeEventListener('drop', resetAutoScrollState, true)
    document.removeEventListener('dragend', resetAutoScrollState, true)
  })
}
