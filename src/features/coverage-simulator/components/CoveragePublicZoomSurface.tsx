import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { clampNewsDetailViewerZoom } from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import { useNewsDetailViewerPan } from '../../../components/news-detail-viewer/useNewsDetailViewerPan'
import { useNewsDetailViewerPinchZoom } from '../../../components/news-detail-viewer/useNewsDetailViewerPinchZoom'
import {
  useNewsDetailViewerZoomAnchor,
  type NewsDetailViewerZoomAnchor,
} from '../../../components/news-detail-viewer/useNewsDetailViewerZoomAnchor'

type Props = {
  children: ReactNode
  /** 변경 시 zoom=1 리셋 */
  documentKey: string
  className?: string
}

export function CoveragePublicZoomSurface({ children, documentKey, className = '' }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [naturalWidth, setNaturalWidth] = useState(360)
  const [naturalHeight, setNaturalHeight] = useState(480)
  const [zoom, setZoom] = useState(1)
  const zoomAnchorRef = useRef<NewsDetailViewerZoomAnchor>(null)

  const updateZoom = useCallback((next: number) => {
    const clamped = Math.max(1, clampNewsDetailViewerZoom(next))
    setZoom((current) => (Math.abs(current - clamped) < 0.001 ? current : clamped))
  }, [])

  useNewsDetailViewerPinchZoom(viewportRef, zoom, updateZoom, true, zoomAnchorRef)
  useNewsDetailViewerZoomAnchor(viewportRef, zoom, zoomAnchorRef)
  useNewsDetailViewerPan(viewportRef, zoom, true)

  useLayoutEffect(() => {
    const doc = docRef.current
    if (!doc) return undefined

    const measure = () => {
      const width = Math.max(1, doc.offsetWidth || doc.scrollWidth || 1)
      const height = Math.max(1, doc.offsetHeight || doc.scrollHeight || 1)
      setNaturalWidth((current) => (Math.abs(current - width) <= 1 ? current : width))
      setNaturalHeight((current) => (Math.abs(current - height) <= 1 ? current : height))
    }

    measure()
    const observer = new ResizeObserver(() => measure())
    observer.observe(doc)
    let orientationFrame = 0
    const onOrientationChange = () => {
      cancelAnimationFrame(orientationFrame)
      orientationFrame = requestAnimationFrame(measure)
    }
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(orientationFrame)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [documentKey])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const frame = requestAnimationFrame(() => {
      updateZoom(1)
      viewport.scrollTo({ left: 0, top: 0 })
    })
    return () => cancelAnimationFrame(frame)
  }, [documentKey, updateZoom])

  const effectiveScale = zoom
  const spacerWidth = naturalWidth * effectiveScale
  const spacerHeight = naturalHeight * effectiveScale

  return (
    <div
      ref={viewportRef}
      data-testid="coverage-public-zoom-viewport"
      data-zoom={zoom.toFixed(6)}
      className={[
        'coverage-simulator-public-zoom-viewport',
        zoom > 1 ? 'coverage-simulator-public-zoom-viewport--zoomed' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="coverage-simulator-public-zoom-spacer"
        style={{ width: spacerWidth, height: spacerHeight }}
      >
        <div
          ref={docRef}
          data-testid="coverage-public-zoom-document"
          className="coverage-simulator-public-zoom-doc"
          style={{
            width: naturalWidth,
            minHeight: naturalHeight,
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
