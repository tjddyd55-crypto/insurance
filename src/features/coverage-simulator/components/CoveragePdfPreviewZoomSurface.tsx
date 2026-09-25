import { useCallback, useRef, useState, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  minScale?: number
  maxScale?: number
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.hypot(dx, dy)
}

export function CoveragePdfPreviewZoomSurface({ children, minScale = 1, maxScale = 3 }: Props) {
  const [scale, setScale] = useState(1)
  const pinchStartDistanceRef = useRef(0)
  const pinchStartScaleRef = useRef(1)

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length === 2) {
        pinchStartDistanceRef.current = touchDistance(event.touches)
        pinchStartScaleRef.current = scale
      }
    },
    [scale],
  )

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length !== 2 || pinchStartDistanceRef.current <= 0) return
    const nextDistance = touchDistance(event.touches)
    const ratio = nextDistance / pinchStartDistanceRef.current
    const nextScale = Math.min(maxScale, Math.max(minScale, pinchStartScaleRef.current * ratio))
    setScale(nextScale)
    if (event.cancelable) event.preventDefault()
  }, [maxScale, minScale])

  const onTouchEnd = useCallback((event: React.TouchEvent) => {
    if (event.touches.length < 2) {
      pinchStartDistanceRef.current = 0
    }
  }, [])

  return (
    <div
      className="coverage-simulator-pdf-preview__zoom-surface"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="coverage-simulator-pdf-preview__zoom-inner"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
      >
        {children}
      </div>
    </div>
  )
}
