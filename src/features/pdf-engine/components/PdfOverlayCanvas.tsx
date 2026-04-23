/**
 * PDF 페이지를 캔버스에 렌더하고, 그 위에 등록된 좌표(placement)를 시각화한다.
 *
 * 역할 분리:
 *   - 이 컴포넌트는 "렌더 + 클릭 좌표 변환" 만 한다. 필드 상태 관리는 상위(Editor) 가.
 *   - 클릭 이벤트는 PDF 포인트 좌표로 정규화해 상위에 전달한다 → 배율과 독립.
 *   - pdfjs 워커 설정은 setupPdfWorker() SSOT 에 위임 — Electron/웹 차이 흡수.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import { canvasToPdf } from '../lib/coordinateMath'
import {
  describePdfLoadError,
  messageForPdfLoadErrorCode,
  PdfLoadError,
  type PdfLoadErrorCode,
} from '../lib/pdfErrors'
import { logger } from '../../../lib/logger'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'

setupPdfWorker()

/*
 * 캔버스 드로잉 전용 내부 상수.
 * 디자인 토큰 대상이 아닌 "마커 렌더 고유의 구현 상수" 라서 파일 상단에 모아둔다.
 * 디자인 변경 시 이곳만 손보면 된다.
 */
const MARK_FILL_SELECTED = 'rgba(234, 88, 12, 0.95)'
const MARK_FILL_DEFAULT = 'rgba(37, 99, 235, 0.92)'
const MARK_STROKE = 'white'
const MARK_LABEL_COLOR = '#0f172a'
const PDF_CANVAS_BG = 'white'

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
  /* 실패 지점의 라벨. UI 는 status === 'error' 일 때만 참조한다.
     개발 모드에선 사용자 메시지 아래에 code 를 조그맣게 노출해 디버깅을 돕는다. */
  const [errorCode, setErrorCode] = useState<PdfLoadErrorCode | 'unknown' | null>(null)

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
      ctx.fillStyle = m.selected ? MARK_FILL_SELECTED : MARK_FILL_DEFAULT
      ctx.fill()
      ctx.strokeStyle = MARK_STROKE
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = MARK_LABEL_COLOR
      ctx.font = '600 11px system-ui, sans-serif'
      ctx.fillText(m.label, cx + 11, cy + 4)
    }
  }, [marks, pageIndex])

  /*
   * status 도 의존성에 넣는다.
   * PDF 첫 로드 완료 시점에는 marks·pageIndex 가 바뀌지 않아
   * drawMarks 이펙트가 재실행되지 않기 때문에,
   * 'ready' 전이를 트리거로 삼아 기존 placement 가 누락되지 않게 한다.
   */
  useEffect(() => {
    if (status !== 'ready') return
    drawMarks()
  }, [drawMarks, status])

  useEffect(() => {
    /*
     * 외부 prop(pdfBuffer/pageIndex) 변화에 동기해 내부 상태를 리셋하고,
     * pdfjs 문서 로딩이라는 외부 자원 취득 흐름을 시작하는 이펙트다.
     * react-hooks/set-state-in-effect 가 이 패턴을 가끔 경고하지만,
     * 외부 리소스 수명주기 동기화가 본 훅의 책임 그 자체다.
     */
    if (!pdfBuffer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('idle')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrorCode(null)
      pageSizeRef.current = null
      return
    }

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrorCode(null)

    /*
     * 각 단계를 독립 try/catch 로 감싸 "어디서 실패했는지" 라벨을 보존한다.
     * 상위는 PdfLoadError 하나로 통일해 받고, 원인은 cause 에 넣어 logger 가 풀어낸다.
     */
    const run = async () => {
      let pdf: PDFDocumentProxy
      try {
        pdf = await getDocument({ data: pdfBuffer }).promise
      } catch (e) {
        throw new PdfLoadError('parse-failed', { byteLength: pdfBuffer.byteLength }, e)
      }
      if (cancelled) return
      onDocumentReady?.(pdf)

      let page
      try {
        page = await pdf.getPage(pageIndex + 1)
      } catch (e) {
        throw new PdfLoadError(
          'page-fetch-failed',
          { pageIndex, numPages: pdf.numPages },
          e,
        )
      }

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
      if (!ctx) {
        throw new PdfLoadError('page-render-failed', { reason: 'canvas-2d-context-null' })
      }
      ctx.fillStyle = PDF_CANVAS_BG
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      try {
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
      } catch (e) {
        throw new PdfLoadError(
          'page-render-failed',
          { pageIndex, canvasW: canvas.width, canvasH: canvas.height },
          e,
        )
      }
    }

    void (async () => {
      try {
        await run()
        if (!cancelled) setStatus('ready')
      } catch (e) {
        if (cancelled) return
        const { code } = describePdfLoadError(e)
        setErrorCode(code)
        setStatus('error')
        logger.error('pdf.overlay.load-failed', {
          code,
          pageIndex,
          byteLength: pdfBuffer.byteLength,
          error: e,
        })
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
          {messageForPdfLoadErrorCode(errorCode)}
          {logger.isDev && errorCode ? (
            <span className="pdf-engine-editor__error-code"> [code: {errorCode}]</span>
          ) : null}
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
