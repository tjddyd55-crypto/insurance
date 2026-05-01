import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { exportSignatureCanvasToPngBlob } from '../utils/signaturePng'

type Point = { x: number; y: number }

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  exportPng: () => Promise<Blob>
}

interface SignaturePadProps {
  className?: string
  onDirtyChange?: (isDirty: boolean) => void
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { className, onDirtyChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const prevPointRef = useRef<Point | null>(null)
  const onDirtyChangeRef = useRef<SignaturePadProps['onDirtyChange']>(onDirtyChange)
  const isDirtyRef = useRef(false)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange
  }, [onDirtyChange])

  const markDirty = useCallback(() => {
    isDirtyRef.current = true
    setIsDirty((prev) => {
      if (!prev) {
        onDirtyChangeRef.current?.(true)
      }
      return true
    })
  }, [])

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    const computed = window.getComputedStyle(canvas)
    const signatureBg = computed.getPropertyValue('--consent-signature-bg').trim() || 'black'
    const signatureInk = computed.getPropertyValue('--consent-signature-ink').trim() || 'white'
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.fillStyle = signatureBg
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = signatureInk
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    drawingRef.current = false
    pointerIdRef.current = null
    prevPointRef.current = null
    isDirtyRef.current = false
    setIsDirty(false)
    onDirtyChangeRef.current?.(false)
  }, [])

  const toLocalPoint = useCallback((event: PointerEvent | ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }, [])

  const drawLineSegment = useCallback((from: Point, to: Point) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }, [])

  const stopDrawing = useCallback(() => {
    drawingRef.current = false
    pointerIdRef.current = null
    prevPointRef.current = null
  }, [])

  const startDraw = useCallback(
    (point: Point) => {
      drawingRef.current = true
      prevPointRef.current = point
      markDirty()
    },
    [markDirty],
  )

  const moveDraw = useCallback(
    (point: Point) => {
      if (!drawingRef.current) {
        return
      }
      const prev = prevPointRef.current
      if (prev) {
        drawLineSegment(prev, point)
      }
      prevPointRef.current = point
    },
    [drawLineSegment],
  )

  useEffect(() => {
    const t = window.requestAnimationFrame(() => setupCanvas())
    const onResize = () => {
      if (isDirtyRef.current) {
        return
      }
      setupCanvas()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(t)
      window.removeEventListener('resize', onResize)
    }
  }, [setupCanvas])

  useImperativeHandle(
    ref,
    () => ({
      clear: setupCanvas,
      isEmpty: () => !isDirty,
      exportPng: async () => {
        const canvas = canvasRef.current
        if (!canvas) {
          throw new Error('서명 캔버스를 찾을 수 없습니다.')
        }
        if (!isDirty) {
          throw new Error('빈 서명은 저장할 수 없습니다.')
        }
        return exportSignatureCanvasToPngBlob(canvas)
      },
    }),
    [isDirty, setupCanvas],
  )

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onPointerDown={(event) => {
        event.preventDefault()
        const canvas = canvasRef.current
        if (!canvas) {
          return
        }
        if (typeof canvas.setPointerCapture === 'function') {
          try {
            canvas.setPointerCapture(event.pointerId)
          } catch {
            // 일부 WebView/Electron 환경은 pointer capture를 거부한다.
            // capture 실패와 무관하게 그리기는 계속 진행한다.
          }
        }
        pointerIdRef.current = event.pointerId
        startDraw(toLocalPoint(event))
      }}
      onPointerMove={(event) => {
        if (!drawingRef.current || pointerIdRef.current !== event.pointerId) {
          return
        }
        event.preventDefault()
        moveDraw(toLocalPoint(event))
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) {
          return
        }
        event.preventDefault()
        stopDrawing()
      }}
      onPointerCancel={stopDrawing}
      onPointerLeave={(event) => {
        if (!drawingRef.current || pointerIdRef.current !== event.pointerId) {
          return
        }
        event.preventDefault()
        stopDrawing()
      }}
      onMouseDown={(event: ReactMouseEvent<HTMLCanvasElement>) => {
        if (window.PointerEvent) {
          return
        }
        event.preventDefault()
        startDraw(toLocalPoint(event.nativeEvent))
      }}
      onMouseMove={(event: ReactMouseEvent<HTMLCanvasElement>) => {
        if (window.PointerEvent) {
          return
        }
        event.preventDefault()
        moveDraw(toLocalPoint(event.nativeEvent))
      }}
      onMouseUp={() => {
        if (window.PointerEvent) {
          return
        }
        stopDrawing()
      }}
      onMouseLeave={() => {
        if (window.PointerEvent) {
          return
        }
        stopDrawing()
      }}
      onTouchStart={(event: ReactTouchEvent<HTMLCanvasElement>) => {
        if (window.PointerEvent) {
          return
        }
        event.preventDefault()
        const touch = event.touches[0]
        if (!touch) {
          return
        }
        startDraw(toLocalPoint(touch))
      }}
      onTouchMove={(event: ReactTouchEvent<HTMLCanvasElement>) => {
        if (window.PointerEvent) {
          return
        }
        event.preventDefault()
        const touch = event.touches[0]
        if (!touch) {
          return
        }
        moveDraw(toLocalPoint(touch))
      }}
      onTouchEnd={() => {
        if (window.PointerEvent) {
          return
        }
        stopDrawing()
      }}
      style={{ touchAction: 'none' }}
    />
  )
})
