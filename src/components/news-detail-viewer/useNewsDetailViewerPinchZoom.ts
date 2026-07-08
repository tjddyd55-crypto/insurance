import { useEffect, useRef, type RefObject } from 'react'
import { clampNewsDetailViewerZoom, getTouchDistance } from './newsDetailViewerZoom'
import type { NewsDetailViewerZoomAnchorRef } from './useNewsDetailViewerZoomAnchor'

type PinchState = {
  startDistance: number
  startZoom: number
}

/**
 * 모바일 두 손가락 pinch로 PC +/- 버튼과 동일한 zoom state를 갱신한다.
 *
 * non-passive touchmove는 두 손가락 pinch가 시작된 순간에만 붙인다.
 * 한 손가락 세로/가로 스크롤은 브라우저 기본 동작을 막지 않는다.
 *
 * anchorRef가 주어지면 두 손가락 중심(컨테이너 기준 client 좌표)을 기록해,
 * 확대 기준점이 좌상단이 아니라 손가락 중심이 되도록 스크롤 보정 훅에 넘긴다.
 */
export function useNewsDetailViewerPinchZoom(
  scrollRef: RefObject<HTMLElement | null>,
  zoom: number,
  onZoomChange: (zoom: number) => void,
  enabled: boolean,
  anchorRef?: NewsDetailViewerZoomAnchorRef,
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

    const recordPinchCenter = (touches: TouchList) => {
      if (!anchorRef || touches.length < 2) {
        return
      }
      const rect = node.getBoundingClientRect()
      const midX = (touches[0].clientX + touches[1].clientX) / 2
      const midY = (touches[0].clientY + touches[1].clientY) / 2
      anchorRef.current = { x: midX - rect.left, y: midY - rect.top }
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
      recordPinchCenter(event.touches)
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
      recordPinchCenter(event.touches)
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
  }, [enabled, scrollRef, anchorRef])
}
