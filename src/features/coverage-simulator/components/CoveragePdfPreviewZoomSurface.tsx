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
import { COVERAGE_PDF_CAPTURE_WIDTH_PX } from '../pdf/coveragePdfCapture'
import {
  computeFitAvailableWidth,
  computeFitScale,
  shouldUpdateFitScale,
} from '../pdf/coveragePdfPreviewZoomMath'

type Props = {
  children: ReactNode
  /** scenario id — 변경 시 zoom=1 리셋 */
  documentKey: string
}

export function CoveragePdfPreviewZoomSurface({ children, documentKey }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [naturalHeight, setNaturalHeight] = useState(1123)
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const fitScaleRef = useRef(1)
  const resizeCallbackCountRef = useRef(0)
  const zoomAnchorRef = useRef<NewsDetailViewerZoomAnchor>(null)

  const updateZoom = useCallback((next: number) => {
    const clamped = Math.max(1, clampNewsDetailViewerZoom(next))
    setZoom((current) => (
      Math.abs(current - clamped) < 0.001 ? current : clamped
    ))
  }, [])

  useNewsDetailViewerPinchZoom(
    viewportRef,
    zoom,
    updateZoom,
    true,
    zoomAnchorRef,
  )
  useNewsDetailViewerZoomAnchor(viewportRef, zoom, zoomAnchorRef)
  useNewsDetailViewerPan(viewportRef, zoom, true)

  useLayoutEffect(() => {
    let cancelled = false
    let frame = 0
    const measureDocument = async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
      await new Promise<void>((resolve) => {
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => resolve())
        })
      })
      if (cancelled) return
      const root = docRef.current?.querySelector(
        '.coverage-simulator-print-root',
      ) as HTMLElement | null
      if (!root) return
      const nextHeight = Math.max(1, root.offsetHeight || root.scrollHeight || 1123)
      setNaturalHeight((current) => (
        Math.abs(current - nextHeight) <= 1 ? current : nextHeight
      ))
    }
    void measureDocument()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [documentKey])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateFit = (countResizeCallback: boolean) => {
      if (countResizeCallback) {
        resizeCallbackCountRef.current += 1
        viewport.dataset.resizeCallbackCount = String(
          resizeCallbackCountRef.current,
        )
      }
      const available = computeFitAvailableWidth(viewport.clientWidth)
      const next = computeFitScale(
        available,
        COVERAGE_PDF_CAPTURE_WIDTH_PX,
      )
      if (!shouldUpdateFitScale(fitScaleRef.current, next)) return
      fitScaleRef.current = next
      setFitScale(next)
    }

    updateFit(false)
    const observer = new ResizeObserver(() => updateFit(true))
    observer.observe(viewport)
    let orientationFrame = 0
    const onOrientationChange = () => {
      cancelAnimationFrame(orientationFrame)
      orientationFrame = requestAnimationFrame(() => updateFit(false))
    }
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(orientationFrame)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const frame = requestAnimationFrame(() => {
      updateZoom(1)
      viewport.scrollTo({ left: 0, top: 0 })
    })
    return () => cancelAnimationFrame(frame)
  }, [documentKey, updateZoom])

  const effectiveScale = fitScale * zoom
  const spacerWidth = COVERAGE_PDF_CAPTURE_WIDTH_PX * effectiveScale
  const spacerHeight = naturalHeight * effectiveScale

  return (
    <div
      ref={viewportRef}
      data-testid="coverage-pdf-preview-viewport"
      data-fit-scale={fitScale.toFixed(6)}
      data-zoom={zoom.toFixed(6)}
      data-resize-callback-count="0"
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
          data-testid="coverage-pdf-preview-visible-document"
          className="coverage-simulator-pdf-preview__zoom-doc"
          style={{
            width: COVERAGE_PDF_CAPTURE_WIDTH_PX,
            height: naturalHeight,
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
