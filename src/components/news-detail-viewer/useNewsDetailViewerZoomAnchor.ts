import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/** 확대/축소 기준점 — 컨테이너 좌상단 기준 client 좌표. null 이면 viewport 중앙. */
export type NewsDetailViewerZoomAnchor = { x: number; y: number } | null

/** anchor 값을 읽고/비우기(consume) 위해 writable 접근이 필요하므로 최소 형태로 정의한다. */
export type NewsDetailViewerZoomAnchorRef = { current: NewsDetailViewerZoomAnchor }

type Metrics = {
  zoom: number
  scrollLeft: number
  scrollTop: number
  scrollWidth: number
  scrollHeight: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  if (max <= min) {
    return min
  }
  return Math.min(max, Math.max(min, value))
}

/**
 * width 기반 확대(.news-detail-zoom-scope)는 스크롤 원점(좌상단)이 고정점이라,
 * 보정을 하지 않으면 확대할수록 콘텐츠가 좌상단으로 밀린다.
 *
 * 이 훅은 zoom 이 바뀔 때, "확대 직전 화면에서 기준점에 있던 콘텐츠 지점" 이
 * 확대 이후에도 같은 화면 위치에 오도록 scrollLeft/scrollTop 을 보정한다.
 *
 * - anchorRef 에 값이 있으면 그 지점(예: pinch 두 손가락 중심) 기준.
 * - 없으면 현재 viewport 중앙 기준.
 *
 * scale 숫자 대신 실제 scrollWidth/Height 비율을 쓰므로 padding·레이아웃 방식에
 * 의존하지 않고, 확대(width 증가)/축소(width 감소) 모두 대칭으로 동작한다.
 */
export function useNewsDetailViewerZoomAnchor(
  scrollRef: RefObject<HTMLElement | null>,
  zoom: number,
  anchorRef?: NewsDetailViewerZoomAnchorRef,
) {
  const prevRef = useRef<Metrics | null>(null)

  // 사용자가 스크롤하면 "확대 직전 기준 좌표" 를 최신으로 유지한다.
  // (축소 시 브라우저가 live scrollLeft 를 clamp 하기 전에 확보해 둔 값을 사용)
  useEffect(() => {
    const node = scrollRef.current
    if (!node) {
      return undefined
    }
    const onScroll = () => {
      const prev = prevRef.current
      if (prev) {
        prev.scrollLeft = node.scrollLeft
        prev.scrollTop = node.scrollTop
      }
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [scrollRef])

  useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) {
      return
    }
    const prev = prevRef.current

    if (prev && prev.zoom !== zoom && prev.scrollWidth > 0 && prev.scrollHeight > 0) {
      const anchor = anchorRef?.current ?? null
      const anchorX = anchor ? anchor.x : node.clientWidth / 2
      const anchorY = anchor ? anchor.y : node.clientHeight / 2

      // 확대 직전, 기준점 아래에 있던 콘텐츠 지점의 상대 위치(0~1).
      const fracX = (prev.scrollLeft + anchorX) / prev.scrollWidth
      const fracY = (prev.scrollTop + anchorY) / prev.scrollHeight

      // 새 레이아웃에서 같은 콘텐츠 지점이 같은 화면 위치에 오도록 스크롤 보정.
      const nextLeft = fracX * node.scrollWidth - anchorX
      const nextTop = fracY * node.scrollHeight - anchorY

      node.scrollLeft = clamp(nextLeft, 0, node.scrollWidth - node.clientWidth)
      node.scrollTop = clamp(nextTop, 0, node.scrollHeight - node.clientHeight)

      if (anchorRef) {
        anchorRef.current = null
      }
    }

    prevRef.current = {
      zoom,
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
      scrollWidth: node.scrollWidth,
      scrollHeight: node.scrollHeight,
    }
  }, [zoom, scrollRef, anchorRef])
}
