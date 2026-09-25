import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import {
  computeFitScale,
  computePinchZoom,
  effectivePdfPreviewScale,
} from '../pdf/coveragePdfPreviewZoomMath'

type Props = {
  children: ReactNode
  /** scenario id — 변경 시 zoom=1 리셋 */
  documentKey: string
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function CoveragePdfPreviewZoomSurface({ children, documentKey }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 794, height: 1123 })
  const [fitScale, setFitScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const pinchRef = useRef<{ initialZoom: number; initialDistance: number } | null>(null)
  const activePointers = useRef(new Map<number, { x: number; y: number }>())

  useEffect(() => {
    setZoom(1)
  }, [documentKey])

  useLayoutEffect(() => {
    const root = docRef.current?.querySelector('.coverage-simulator-print-root') as HTMLElement | null
    if (!root) return
    const width = root.offsetWidth || 794
    const height = root.offsetHeight || 1123
    setNaturalSize({ width, height })
  }, [documentKey, children])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateFit = () => {
      const padding = 16
      const available = Math.max(1, viewport.clientWidth - padding)
      setFitScale(computeFitScale(available, naturalSize.width))
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

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.buttons !== 1) return
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (activePointers.current.size === 2) {
      const points = [...activePointers.current.values()]
      pinchRef.current = {
        initialZoom: zoom,
        initialDistance: pointerDistance(points[0], points[1]),
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [zoom])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!activePointers.current.has(event.pointerId)) return
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (activePointers.current.size === 2 && pinchRef.current) {
      const points = [...activePointers.current.values()]
      const distance = pointerDistance(points[0], points[1])
      setZoom(computePinchZoom(pinchRef.current.initialZoom, pinchRef.current.initialDistance, distance))
      event.preventDefault()
    }
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    activePointers.current.delete(event.pointerId)
    if (activePointers.current.size < 2) {
      pinchRef.current = null
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }, [])

  const effectiveScale = effectivePdfPreviewScale(fitScale, zoom)
  const spacerWidth = naturalSize.width * effectiveScale
  const spacerHeight = naturalSize.height * effectiveScale

  return (
    <div
      ref={viewportRef}
      className="coverage-simulator-pdf-preview__zoom-viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
