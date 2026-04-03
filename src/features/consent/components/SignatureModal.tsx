import { useCallback, useEffect, useRef, useState } from 'react'

export interface SignatureModalProps {
  open: boolean
  onClose: () => void
  onSave: (dataUrlBase64: string) => void
}

export function SignatureModal({ open, onClose, onSave }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.floor(rect.width * dpr))
    const h = Math.max(1, Math.floor(rect.height * dpr))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#1a1f26'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setHasStroke(false)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    const t = window.requestAnimationFrame(() => setupCanvas())
    const onResize = () => setupCanvas()
    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(t)
      window.removeEventListener('resize', onResize)
    }
  }, [open, setupCanvas])

  const startStroke = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) {
        return
      }
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      drawingRef.current = true
      ctx.beginPath()
      ctx.moveTo(x, y)
      setHasStroke(true)
    },
    [],
  )

  const moveStroke = useCallback((clientX: number, clientY: number) => {
    if (!drawingRef.current) {
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [])

  const endStroke = useCallback(() => {
    drawingRef.current = false
  }, [])

  const handleClear = useCallback(() => {
    setupCanvas()
  }, [setupCanvas])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasStroke) {
      return
    }
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
    onClose()
  }, [hasStroke, onClose, onSave])

  if (!open) {
    return null
  }

  return (
    <div className="consent-signature-overlay" role="dialog" aria-modal="true" aria-labelledby="consent-signature-title">
      <header className="consent-signature-header">
        <h2 id="consent-signature-title" className="consent-signature-header__title">
          서명
        </h2>
      </header>
      <div className="consent-signature-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="consent-signature-canvas"
          onMouseDown={(e) => startStroke(e.clientX, e.clientY)}
          onMouseMove={(e) => moveStroke(e.clientX, e.clientY)}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onTouchStart={(e) => {
            e.preventDefault()
            const t = e.touches[0]
            if (t) {
              startStroke(t.clientX, t.clientY)
            }
          }}
          onTouchMove={(e) => {
            e.preventDefault()
            const t = e.touches[0]
            if (t) {
              moveStroke(t.clientX, t.clientY)
            }
          }}
          onTouchEnd={endStroke}
        />
      </div>
      <footer className="consent-signature-footer">
        <button type="button" className="consent-btn consent-btn--secondary" onClick={handleClear}>
          초기화
        </button>
        <button type="button" className="consent-btn" onClick={handleSave} disabled={!hasStroke}>
          저장
        </button>
      </footer>
    </div>
  )
}
