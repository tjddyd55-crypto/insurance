import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { clampNewsDetailViewerZoom } from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import { useNewsDetailViewerPan } from '../../../components/news-detail-viewer/useNewsDetailViewerPan'
import { useNewsDetailViewerPinchZoom } from '../../../components/news-detail-viewer/useNewsDetailViewerPinchZoom'
import {
  useNewsDetailViewerZoomAnchor,
  type NewsDetailViewerZoomAnchor,
} from '../../../components/news-detail-viewer/useNewsDetailViewerZoomAnchor'
import { computeFitScale } from '../pdf/coveragePdfPreviewZoomMath'

type Props = {
  children: ReactNode
  /** scenario id — 변경 시 zoom=1 리셋 */
  documentKey: string
}

export function CoveragePdfPreviewZoomSurface({ children, documentKey }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 794, height: 1123 })
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const zoomAnchorRef = useRef<NewsDetailViewerZoomAnchor>(null)

  useNewsDetailViewerPinchZoom(
    viewportRef,
    zoom,
    (next) => setZoom(Math.max(1, clampNewsDetailViewerZoom(next))),
    true,
    zoomAnchorRef,
  )
  useNewsDetailViewerZoomAnchor(viewportRef, zoom, zoomAnchorRef)
  useNewsDetailViewerPan(viewportRef, zoom, true)

  useLayoutEffect(() => {
    const root = docRef.current?.querySelector('.coverage-simulator-print-root') as HTMLElement | null
    if (!root) return
    const frame = requestAnimationFrame(() => {
      const width = root.offsetWidth || 794
      const height = root.offsetHeight || 1123
      setNaturalSize({ width, height })
    })
    return () => cancelAnimationFrame(frame)
  }, [documentKey])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateFit = () => {
      const padding = 16
      const available = Math.max(1, viewport.clientWidth - padding)
      setFitScale(computeFitScale(available, naturalSize.width))
      setZoom(1)
    }
    updateFit()
    const observer = new ResizeObserver(updateFit)
    observer.observe(viewport)
    window.addEventListener('orientationchange', updateFit)
    return () => {
      observer.disconnect()
      window.removeEventListener('orientationchange', updateFit)
    }
  }, [naturalSize.width])

  const effectiveScale = fitScale * zoom
  const spacerWidth = naturalSize.width * effectiveScale
  const spacerHeight = naturalSize.height * effectiveScale

  return (
    <div
      ref={viewportRef}
      className={[
        'coverage-simulator-pdf-preview__zoom-viewport',
        zoom > 1 ? 'coverage-simulator-pdf-preview__zoom-viewport--zoomed' : '',
      ].join(' ')}
    >
      <div
        className="coverage-simulator-pdf-preview__zoom-spacer"
        style={{ width: spacerWidth, height: spacerHeight }}
      >
        <div
          ref={docRef}
          className="coverage-simulator-pdf-preview__zoom-doc"
          style={{
            width: naturalSize.width,
            height: naturalSize.height,
            transform: `scale(${effectiveScale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
