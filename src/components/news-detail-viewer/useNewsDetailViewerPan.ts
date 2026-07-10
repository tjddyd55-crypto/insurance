import { useEffect, type RefObject } from 'react'

/**
 * zoom > 1 일 때 스크롤 컨테이너에서 X/Y 를 동시에 pan 한다.
 * - PC: 마우스 드래그
 * - 모바일: 한 손가락 드래그 (두 손가락 pinch 는 별도 훅)
 *
 * 축 우선(axis lock) 없이 scrollLeft/scrollTop 을 독립 갱신한다.
 */
export function useNewsDetailViewerPan(
  scrollRef: RefObject<HTMLElement | null>,
  zoom: number,
  enabled: boolean,
) {
  useEffect(() => {
    const node = scrollRef.current
    if (!node || !enabled || zoom <= 1) {
      return undefined
    }

    const activePointers = new Set<number>()
    let dragPointerId: number | null = null
    let lastX = 0
    let lastY = 0

    const stopDrag = () => {
      dragPointerId = null
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return
      }
      activePointers.add(event.pointerId)
      if (activePointers.size > 1) {
        stopDrag()
        return
      }
      dragPointerId = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      node.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (dragPointerId !== event.pointerId) {
        return
      }
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      if (dx === 0 && dy === 0) {
        return
      }
      lastX = event.clientX
      lastY = event.clientY
      node.scrollLeft -= dx
      node.scrollTop -= dy
      event.preventDefault()
    }

    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId)
      if (dragPointerId === event.pointerId) {
        stopDrag()
      }
      if (node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId)
      }
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
  }, [scrollRef, zoom, enabled])
}
