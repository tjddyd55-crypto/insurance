/**
 * PDF 페이지를 캔버스에 렌더하고, 그 위에 등록된 좌표(placement)를 시각화한다.
 *
 * 역할 분리:
 *   - 이 컴포넌트는 "렌더 + 좌표 픽(클릭/드래그)" 만 한다. 필드 상태 관리는 상위(Editor) 가.
 *   - 픽 이벤트는 PDF 포인트 좌표로 정규화해 상위에 전달한다 → 배율과 독립.
 *   - pdfjs 워커 설정은 setupPdfWorker() SSOT 에 위임 — Electron/웹 차이 흡수.
 *
 * 두 가지 픽 모드:
 *   - 'pick-point': 단일 클릭 → {x, y}
 *   - 'pick-box'  : 드래그 → {x, y, width, height}
 *     사용자가 실수로 "누르자마자 뗀" 드래그(이동 거리 매우 작음)는 무시해
 *     잡음 placement 생성을 막는다. 상위가 기본값을 주고 싶다면 pick-point 를 쓰면 된다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import { canvasLengthToPdf, canvasToPdf } from '../lib/coordinateMath'
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
const MARK_FILL_SELECTED = 'rgba(255, 77, 79, 0.98)'
const MARK_FILL_DEFAULT = 'rgba(0, 163, 255, 0.96)'
const MARK_STROKE = '#ffffff'
const MARK_LABEL_COLOR = '#ffffff'
const MARK_LABEL_BG = 'rgba(15, 23, 42, 0.9)'
const BOX_FILL_SELECTED = 'rgba(255, 77, 79, 0.16)'
const BOX_FILL_DEFAULT = 'rgba(0, 163, 255, 0.14)'
const BOX_STROKE_SELECTED = 'rgba(255, 77, 79, 0.98)'
const BOX_STROKE_DEFAULT = 'rgba(0, 163, 255, 0.95)'
const DRAG_PREVIEW_FILL = 'rgba(255, 77, 79, 0.12)'
const DRAG_PREVIEW_STROKE = 'rgba(255, 77, 79, 0.98)'
const PDF_CANVAS_BG = 'white'

/**
 * 드래그 박스 픽이 유효하다고 판정하는 최소 치수(CSS 픽셀).
 * 실수 클릭·떨림으로 아주 얇은 박스가 생기는 걸 막는다.
 */
const MIN_BOX_SIZE_PX = 6

/** 상위에서 그려야 할 마커 한 개. */
export interface OverlayMark {
  id: string
  pageIndex: number
  /** PDF 포인트. 원점 좌하단. */
  x: number
  y: number
  /**
   * PDF 포인트 기준 박스 크기. 있으면 사각형 박스 마커로 렌더한다.
   * 둘 중 하나라도 null/undefined 면 점 마커로 폴백(기존 placement 하위 호환).
   */
  width?: number | null
  height?: number | null
  /** 마커 라벨(필드 라벨). */
  label: string
  /** 선택된 상태(강조). */
  selected?: boolean
}

export interface OverlayPick {
  /** PDF 포인트. 박스 모드에선 좌하단 꼭짓점. */
  x: number
  y: number
  /** 박스 모드에서만 채워짐(PDF 포인트). */
  width?: number
  height?: number
  /** 현재 페이지 인덱스. */
  pageIndex: number
  /** 변환 기준 PDF 페이지 크기. */
  pdfWidth: number
  pdfHeight: number
}

export type OverlayPickMode = 'pick-point' | 'pick-box'

interface Props {
  pdfBuffer: ArrayBuffer | null
  pageIndex: number
  marks: OverlayMark[]
  clickEnabled: boolean
  onPick: (p: OverlayPick) => void
  onSelectMark?: (markId: string) => void
  onDocumentReady?: (doc: PDFDocumentProxy) => void
  /** 기본 'pick-point'. 'pick-box' 이면 드래그로 영역을 잡는다. */
  mode?: OverlayPickMode
}

/**
 * CSS 픽셀 좌표 → 실제 캔버스 버퍼 픽셀 좌표로 변환.
 * getBoundingClientRect 기준 (CSS 픽셀) 과 canvas.width/height(디바이스 픽셀) 은 비율이 다를 수 있다.
 */
function cssToCanvasPixels(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

interface DragState {
  /** 캔버스 버퍼 좌표(픽셀). */
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function PdfOverlayCanvas({
  pdfBuffer,
  pageIndex,
  marks,
  clickEnabled,
  onPick,
  onSelectMark,
  onDocumentReady,
  mode = 'pick-point',
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const markCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageSizeRef = useRef<{ widthPt: number; heightPt: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  /* 실패 지점의 라벨. UI 는 status === 'error' 일 때만 참조한다.
     개발 모드에선 사용자 메시지 아래에 code 를 조그맣게 노출해 디버깅을 돕는다. */
  const [errorCode, setErrorCode] = useState<PdfLoadErrorCode | 'unknown' | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  /** 드래그 중 프리뷰 박스 하나를 marks 위에 덧그린다. 렌더가 별 함수로 빠져 있어야
      drawMarks 의 단일 책임을 해치지 않는다. */
  const drawPreviewBox = useCallback((ctx: CanvasRenderingContext2D, d: DragState) => {
    const x = Math.min(d.startX, d.currentX)
    const y = Math.min(d.startY, d.currentY)
    const w = Math.abs(d.currentX - d.startX)
    const h = Math.abs(d.currentY - d.startY)
    ctx.fillStyle = DRAG_PREVIEW_FILL
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = DRAG_PREVIEW_STROKE
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.strokeRect(x, y, w, h)
    ctx.setLineDash([])
  }, [])

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
      /* 원점이 좌하단이라 y 축을 뒤집어 준다. */
      const cyBottom = ((pageSize.heightPt - m.y) / pageSize.heightPt) * markCanvas.height

      const hasBox = typeof m.width === 'number' && typeof m.height === 'number' && m.width > 0 && m.height > 0
      if (hasBox) {
        /* PDF 의 width/height 를 캔버스 픽셀로 환산. y 는 좌하단 원점이므로
           박스의 "위쪽 모서리" 는 cyBottom - heightPx. */
        const widthPx = ((m.width as number) / pageSize.widthPt) * markCanvas.width
        const heightPx = ((m.height as number) / pageSize.heightPt) * markCanvas.height
        const boxX = cx
        const boxY = cyBottom - heightPx

        ctx.fillStyle = m.selected ? BOX_FILL_SELECTED : BOX_FILL_DEFAULT
        ctx.fillRect(boxX, boxY, widthPx, heightPx)
        ctx.strokeStyle = m.selected ? BOX_STROKE_SELECTED : BOX_STROKE_DEFAULT
        ctx.lineWidth = m.selected ? 2 : 1.5
        ctx.strokeRect(boxX, boxY, widthPx, heightPx)

        drawMarkLabel(ctx, m.label, boxX + 2, boxY - 4)
      } else {
        /* 점 마커(기존 placement 하위 호환). */
        ctx.beginPath()
        ctx.arc(cx, cyBottom, m.selected ? 9 : 7, 0, Math.PI * 2)
        ctx.fillStyle = m.selected ? MARK_FILL_SELECTED : MARK_FILL_DEFAULT
        ctx.fill()
        ctx.strokeStyle = MARK_STROKE
        ctx.lineWidth = 2
        ctx.stroke()
        drawMarkLabel(ctx, m.label, cx + 11, cyBottom + 4)
      }
    }

    if (drag) drawPreviewBox(ctx, drag)
  }, [marks, pageIndex, drag, drawPreviewBox])

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
     * react-hooks/set-state-in-effect 가 이 패턴을 경고할 때가 있다(플러그인 버전 의존).
     * 외부 리소스 수명주기 동기화가 본 훅의 책임 그 자체다 → disable 로 의도를 고정.
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

      /*
       * 좌표 정밀 편집 시 확대 가능 폭을 넉넉히 잡는다.
       * 기존 920px 상한은 큰 모니터/사이드바 접힘 상태에서도 PDF가 작게 보이는 원인이었다.
       */
      const maxW = Math.min(1600, Math.max(420, wrap.clientWidth || 900))
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

  /* ---------- 포인트 모드: 단순 클릭 ---------- */

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'pick-point') return
    if (!clickEnabled || status !== 'ready') return
    const canvas = canvasRef.current
    const pageSize = pageSizeRef.current
    if (!canvas || !pageSize) return

    const { x: px, y: py } = cssToCanvasPixels(e.clientX, e.clientY, canvas)

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

  /* ---------- 박스 모드: 드래그 ---------- */

  const trySelectExistingMark = useCallback(
    (clientX: number, clientY: number): boolean => {
      const canvas = canvasRef.current
      const pageSize = pageSizeRef.current
      if (!canvas || !pageSize) return false
      const { x, y } = cssToCanvasPixels(clientX, clientY, canvas)
      const hitRadius = 12
      const pageMarks = [...marks].filter((m) => m.pageIndex === pageIndex).reverse()
      for (const m of pageMarks) {
        const cx = (m.x / pageSize.widthPt) * canvas.width
        const cyBottom = ((pageSize.heightPt - m.y) / pageSize.heightPt) * canvas.height
        const hasBox = typeof m.width === 'number' && typeof m.height === 'number' && m.width > 0 && m.height > 0
        if (hasBox) {
          const widthPx = ((m.width as number) / pageSize.widthPt) * canvas.width
          const heightPx = ((m.height as number) / pageSize.heightPt) * canvas.height
          const boxX = cx
          const boxY = cyBottom - heightPx
          if (x >= boxX && x <= boxX + widthPx && y >= boxY && y <= boxY + heightPx) {
            onSelectMark?.(m.id)
            return true
          }
          continue
        }
        const dx = x - cx
        const dy = y - cyBottom
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          onSelectMark?.(m.id)
          return true
        }
      }
      return false
    },
    [marks, onSelectMark, pageIndex],
  )

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'pick-box') return
    if (!clickEnabled || status !== 'ready') return
    if (e.button !== 0) return
    if (trySelectExistingMark(e.clientX, e.clientY)) {
      e.preventDefault()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = cssToCanvasPixels(e.clientX, e.clientY, canvas)
    setDrag({ startX: x, startY: y, currentX: x, currentY: y })
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drag) return
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = cssToCanvasPixels(e.clientX, e.clientY, canvas)
    setDrag({ ...drag, currentX: x, currentY: y })
  }

  const finalizeDrag = useCallback(() => {
    if (!drag) return
    const canvas = canvasRef.current
    const pageSize = pageSizeRef.current
    const current = drag
    /* 드래그 상태는 즉시 비워야 실패·성공과 무관하게 프리뷰가 남지 않는다. */
    setDrag(null)
    if (!canvas || !pageSize) return

    /* CSS 픽셀 기준 최소 치수로 판정해 잡음 클릭을 걸러낸다.
       캔버스 버퍼 픽셀 기준이 아니라 사용자가 본 화면 기준이어야 직관과 맞다. */
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width > 0 ? rect.width / canvas.width : 1
    const scaleY = rect.height > 0 ? rect.height / canvas.height : 1
    const boxCssWidth = Math.abs(current.currentX - current.startX) * scaleX
    const boxCssHeight = Math.abs(current.currentY - current.startY) * scaleY
    if (boxCssWidth < MIN_BOX_SIZE_PX || boxCssHeight < MIN_BOX_SIZE_PX) {
      return
    }

    /* 박스의 좌상단을 canvas 기준으로 확정한 뒤, 좌하단 꼭짓점을 PDF 좌표로 변환한다.
       PDF 좌표계는 원점이 좌하단이므로 placement.x, placement.y 는 박스의 좌하단. */
    const leftPx = Math.min(current.startX, current.currentX)
    const topPx = Math.min(current.startY, current.currentY)
    const widthPx = Math.abs(current.currentX - current.startX)
    const heightPx = Math.abs(current.currentY - current.startY)
    const bottomPx = topPx + heightPx

    const pdfOrigin = canvasToPdf(
      { x: leftPx, y: bottomPx },
      { width: canvas.width, height: canvas.height },
      { widthPt: pageSize.widthPt, heightPt: pageSize.heightPt },
    )
    const widthPt = canvasLengthToPdf(
      widthPx,
      { width: canvas.width, height: canvas.height },
      { widthPt: pageSize.widthPt, heightPt: pageSize.heightPt },
      'x',
    )
    const heightPt = canvasLengthToPdf(
      heightPx,
      { width: canvas.width, height: canvas.height },
      { widthPt: pageSize.widthPt, heightPt: pageSize.heightPt },
      'y',
    )

    onPick({
      x: pdfOrigin.x,
      y: pdfOrigin.y,
      width: widthPt,
      height: heightPt,
      pageIndex,
      pdfWidth: pageSize.widthPt,
      pdfHeight: pageSize.heightPt,
    })
  }, [drag, onPick, pageIndex])

  const handleMouseUp = () => {
    if (mode !== 'pick-box') return
    finalizeDrag()
  }

  const handleMouseLeave = () => {
    /* 캔버스 밖으로 나가면 드래그를 "취소" 로 처리. 사용자가 의도한 박스가 아닐 가능성 크다. */
    if (drag) setDrag(null)
  }

  const cursorStyle = useMemo<React.CSSProperties>(() => {
    if (!clickEnabled || status !== 'ready') return {}
    if (mode === 'pick-box') return { cursor: 'crosshair' }
    return { cursor: 'crosshair' }
  }, [clickEnabled, status, mode])

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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          role="presentation"
          aria-label="PDF 좌표 선택 — 선택된 필드를 그 위치에 배치합니다"
          style={cursorStyle}
        />
        <canvas ref={markCanvasRef} className="pdf-engine-editor__mark-canvas" aria-hidden />
      </div>
    </div>
  )
}

/**
 * 라벨을 "배경 + 글자" 로 그린다. 배경이 없으면 PDF 배경색과 뒤섞여
 * 겹치는 영역에서 가독성이 급격히 떨어진다.
 */
function drawMarkLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
): void {
  ctx.font = '600 11px system-ui, sans-serif'
  const metrics = ctx.measureText(label)
  const padding = 3
  const textWidth = metrics.width + padding * 2
  const textHeight = 14
  ctx.fillStyle = MARK_LABEL_BG
  ctx.fillRect(x - padding, y - textHeight + 2, textWidth, textHeight)
  ctx.fillStyle = MARK_LABEL_COLOR
  ctx.fillText(label, x, y)
}
