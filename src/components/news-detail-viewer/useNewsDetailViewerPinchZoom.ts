import { useEffect, useRef, type RefObject } from 'react'
import { clampNewsDetailViewerZoom, getTouchDistance } from './newsDetailViewerZoom'

type PinchState = {
  startDistance: number
  startZoom: number
}

/**
 * 모바일 두 손가락 pinch로 PC +/- 버튼과 동일한 zoom state를 갱신한다.
 *
 * non-passive touchmove는 두 손가락 pinch가 시작된 순간에만 붙인다.
 * 한 손가락 세로/가로 스크롤은 브라우저 기본 동작을 막지 않는다.
 */
export function useNewsDetailViewerPinchZoom(
  scrollRef: RefObject<HTMLElement | null>,
  zoom: number,
  onZoomChange: (zoom: number) => void,
  enabled: boolean,
) {
  const pinchRef = useRef<PinchState | null>(null)
  const zoomRef = useRef(zoom)
  const onZoomChangeRef = useRef(onZoomChange)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !enabled) {
      return undefined
    }

    let pinchMoveAttached = false

    const detachPinchMove = () => {
      if (!pinchMoveAttached) {
        return
      }
      node.removeEventListener('touchmove', onTouchMove)
      pinchMoveAttached = false
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        pinchRef.current = null
        detachPinchMove()
        return
      }
      const pinch = pinchRef.current
      if (!pinch || pinch.startDistance <= 0) {
        return
      }
      event.preventDefault()
      const scale = getTouchDistance(event.touches) / pinch.startDistance
      onZoomChangeRef.current(clampNewsDetailViewerZoom(pinch.startZoom * scale))
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        pinchRef.current = null
        detachPinchMove()
        return
      }
      pinchRef.current = {
        startDistance: getTouchDistance(event.touches),
        startZoom: zoomRef.current,
      }
      if (!pinchMoveAttached) {
        node.addEventListener('touchmove', onTouchMove, { passive: false })
        pinchMoveAttached = true
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchRef.current = null
        detachPinchMove()
      }
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchend', onTouchEnd, { passive: true })
    node.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      detachPinchMove()
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('touchcancel', onTouchEnd)
      pinchRef.current = null
    }
  }, [enabled, scrollRef])
}
