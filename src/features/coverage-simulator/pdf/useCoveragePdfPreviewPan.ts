import { useEffect, type RefObject } from 'react'

/**
 * 보장 PDF 프리뷰 전용 팬.
 * 뉴스 뷰어 훅은 pointerdown 에서 바로 포인터를 잡아 확대 중 핀치를 막는다.
 * 터치는 이동이 시작된 뒤에만 캡처하고, 두 번째 포인터가 오면 팬을 취소한다.
 */
export function useCoveragePdfPreviewPan(
  scrollRef: RefObject<HTMLElement | null>,
  zoom: number,
  enabled: boolean,
) {
  useEffect(() => {
    const node = scrollRef.current
    if (!node || !enabled || zoom <= 1) return undefined

    const activePointers = new Set<number>()
    let dragPointerId: number | null = null
    let lastX = 0
    let lastY = 0
    let captured = false

    const release = (pointerId: number) => {
      if (captured && node.hasPointerCapture(pointerId)) {
        node.releasePointerCapture(pointerId)
      }
      captured = false
    }

    const stopDrag = () => {
      if (dragPointerId != null) release(dragPointerId)
      dragPointerId = null
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      activePointers.add(event.pointerId)
      if (activePointers.size > 1) {
        stopDrag()
        return
      }
      dragPointerId = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      if (event.pointerType === 'mouse') {
        node.setPointerCapture(event.pointerId)
        captured = true
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (activePointers.size > 1 || dragPointerId !== event.pointerId) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      if (dx === 0 && dy === 0) return
      if (!captured) {
        node.setPointerCapture(event.pointerId)
        captured = true
      }
      lastX = event.clientX
      lastY = event.clientY
      node.scrollLeft -= dx
      node.scrollTop -= dy
      if (event.cancelable) event.preventDefault()
    }

    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId)
      if (dragPointerId === event.pointerId) stopDrag()
      else release(event.pointerId)
    }

    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('pointermove', onPointerMove)
    node.addEventListener('pointerup', onPointerUp)
    node.addEventListener('pointercancel', onPointerUp)
    return () => {
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onPointerUp)
      node.removeEventListener('pointercancel', onPointerUp)
    }
  }, [enabled, scrollRef, zoom])
}
