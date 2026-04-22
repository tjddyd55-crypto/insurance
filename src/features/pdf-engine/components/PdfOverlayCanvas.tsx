/**
 * PDF 페이지를 캔버스에 렌더하고, 그 위에 등록된 좌표(placement)를 시각화한다.
 *
 * 역할 분리:
 *   - 이 컴포넌트는 "렌더 + 클릭 좌표 변환" 만 한다. 필드 상태 관리는 상위(Editor) 가.
 *   - 클릭 이벤트는 PDF 포인트 좌표로 정규화해 상위에 전달한다 → 배율과 독립.
 *
 * pdfjs-dist 의 worker 는 기존 consent 에디터와 동일한 방식으로 초기화한다
 * (번들러가 worker URL 을 해석하도록 `new URL(..., import.meta.url)` 사용).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import { canvasToPdf } from '../lib/coordinateMath'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/** 상위에서 그려야 할 마커 한 개. */
export interface OverlayMark {
  id: string
  pageIndex: number
  /** PDF 포인트. 원점 좌하단. */
  x: number
  y: number
  /** 마커 라벨(필드 key). */
  label: string
  /** 선택된 상태(강조). */
  selected?: boolean
}

export interface OverlayPick {
  /** PDF 포인트. */
  x: number
  y: number
  /** 현재 페이지 인덱스. */
  pageIndex: number
  /** 변환 기준 PDF 페이지 크기. */
  pdfWidth: number
  pdfHeight: number
}

interface Props {
  pdfBuffer: ArrayBuffer | null
  pageIndex: number
  marks: OverlayMark[]
  clickEnabled: boolean
  onPick: (p: OverlayPick) => void
  onDocumentReady?: (doc: PDFDocumentProxy) => void
}

export function PdfOverlayCanvas({
  pdfBuffer,
  pageIndex,
  marks,
  clickEnabled,
  onPick,
  onDocumentReady,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const markCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageSizeRef = useRef<{ widthPt: number; heightPt: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const drawMarks = useCallback(() => {
    const pdfCanvas = canvasRef.current
    const markCanvas = markCanvasRef.current
    const pageSize = pageSizeRef.current
    if (!pdfCanvas || !markCanvas || !pageSize) return

    markCanvas.width = pdfCanvas.width
    markCanvas.height = pdfCanvas.height
    const ctx = markCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, markCanvas.width, markCanvas.height)

    for (const m of marks) {
      if (m.pageIndex !== pageIndex) continue
      const cx = (m.x / pageSize.widthPt) * markCanvas.width
      const cy = ((pageSize.heightPt - m.y) / pageSize.heightPt) * markCanvas.height

      ctx.beginPath()
      ctx.arc(cx, cy, m.selected ? 9 : 7, 0, Math.PI * 2)
      ctx.fillStyle = m.selected ? 'rgba(234, 88, 12, 0.95)' : 'rgba(37, 99, 235, 0.92)'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#0f172a'
      ctx.font = '600 11px system-ui, sans-serif'
      ctx.fillText(m.label, cx + 11, cy + 4)
    }
  }, [marks, pageIndex])

  useEffect(() => {
    drawMarks()
  }, [drawMarks])

  useEffect(() => {
    if (!pdfBuffer) {
      setStatus('idle')
      pageSizeRef.current = null
      return
    }

    let cancelled = false
    setStatus('loading')
    ;(async () => {
      try {
        const pdf = await getDocument({ data: pdfBuffer }).promise
        if (cancelled) return
        onDocumentReady?.(pdf)

        const page = await pdf.getPage(pageIndex + 1)
        const base = page.getViewport({ scale: 1 })
        const wrap = wrapRef.current
        const canvas = canvasRef.current
        if (!canvas || !wrap || cancelled) return

        const maxW = Math.min(920, Math.max(320, wrap.clientWidth || 640))
        const scale = maxW / base.width
        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        pageSizeRef.current = { widthPt: base.width, heightPt: base.height }

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pdfBuffer, pageIndex, onDocumentReady])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!clickEnabled || status !== 'ready') return
    const canvas = canvasRef.current
    const pageSize = pageSizeRef.current
    if (!canvas || !pageSize) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY

    const pdf = canvasToPdf(
      { x: px, y: py },
      { width: canvas.width, height: canvas.height },
      { widthPt: pageSize.widthPt, heightPt: pageSize.heightPt },
    )
    onPick({
      x: pdf.x,
      y: pdf.y,
      pageIndex,
      pdfWidth: pageSize.widthPt,
      pdfHeight: pageSize.heightPt,
    })
  }

  if (!pdfBuffer) {
    return (
      <p className="pdf-engine-editor__hint">
        PDF 파일을 업로드하거나 기존 템플릿을 불러오면 미리보기가 표시됩니다.
      </p>
    )
  }

  return (
    <div>
      {status === 'loading' ? (
        <p className="pdf-engine-editor__hint">PDF 렌더링 중…</p>
      ) : null}
      {status === 'error' ? (
        <p className="pdf-engine-editor__error">
          PDF 를 표시하지 못했습니다. 파일 형식을 확인해 주세요.
        </p>
      ) : null}
      <div ref={wrapRef} className="pdf-engine-editor__overlay">
        <canvas
          ref={canvasRef}
          className="pdf-engine-editor__pdf-canvas"
          onClick={handleClick}
          role="presentation"
          aria-label="PDF 좌표 선택 — 선택된 필드를 그 위치에 배치합니다"
        />
        <canvas ref={markCanvasRef} className="pdf-engine-editor__mark-canvas" aria-hidden />
      </div>
    </div>
  )
}
