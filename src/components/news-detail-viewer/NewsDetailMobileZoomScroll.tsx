import { useRef, useState, type ReactNode } from 'react'
import NewsDetailZoomContent from './NewsDetailZoomContent'
import { clampNewsDetailViewerZoom } from './newsDetailViewerZoom'
import { useNewsDetailViewerPinchZoom } from './useNewsDetailViewerPinchZoom'
import { useNewsDetailViewerPan } from './useNewsDetailViewerPan'
import {
  useNewsDetailViewerZoomAnchor,
  type NewsDetailViewerZoomAnchor,
} from './useNewsDetailViewerZoomAnchor'

type NewsDetailMobileZoomScrollProps = {
  children: ReactNode
  className?: string
  enabled?: boolean
}

/**
 * 모바일 소식지 상세(라우트 페이지)용 pinch zoom + width 기반 확대 스크롤.
 * PC 목록 인라인 모달은 NewsDetailViewerModal을 그대로 사용한다.
 */
export default function NewsDetailMobileZoomScroll({
  children,
  className,
  enabled = true,
}: NewsDetailMobileZoomScrollProps) {
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const zoomAnchorRef = useRef<NewsDetailViewerZoomAnchor>(null)

  useNewsDetailViewerPinchZoom(
    scrollRef,
    zoom,
    (next) => setZoom(clampNewsDetailViewerZoom(next)),
    enabled,
    zoomAnchorRef,
  )
  useNewsDetailViewerZoomAnchor(scrollRef, zoom, zoomAnchorRef)
  useNewsDetailViewerPan(scrollRef, zoom, enabled)

  return (
    <div
      ref={scrollRef}
      className={[
        'news-detail-mobile-scroll',
        zoom > 1 ? 'news-detail-mobile-scroll--zoomed' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <NewsDetailZoomContent zoom={zoom}>{children}</NewsDetailZoomContent>
    </div>
  )
}
