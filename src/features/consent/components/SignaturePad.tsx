import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  const [isDirty, setIsDirty] = useState(false)

  const markDirty = useCallback(() => {
    setIsDirty((prev) => {
      if (!prev) {
        onDirtyChange?.(true)
      }
      return true
    })
  }, [onDirtyChange])

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
    setIsDirty(false)
    onDirtyChange?.(false)
  }, [onDirtyChange])

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
    const mid: Point = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.quadraticCurveTo(from.x, from.y, mid.x, mid.y)
    ctx.stroke()
  }, [])

  const stopDrawing = useCallback(() => {
    drawingRef.current = false
    pointerIdRef.current = null
    prevPointRef.current = null
  }, [])

  useEffect(() => {
    const t = window.requestAnimationFrame(() => setupCanvas())
    const onResize = () => setupCanvas()
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
        canvas.setPointerCapture(event.pointerId)
        pointerIdRef.current = event.pointerId
        drawingRef.current = true
        prevPointRef.current = toLocalPoint(event)
        markDirty()
      }}
      onPointerMove={(event) => {
        if (!drawingRef.current || pointerIdRef.current !== event.pointerId) {
          return
        }
        event.preventDefault()
        const current = toLocalPoint(event)
        const prev = prevPointRef.current
        if (prev) {
          drawLineSegment(prev, current)
        }
        prevPointRef.current = current
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
    />
  )
})
