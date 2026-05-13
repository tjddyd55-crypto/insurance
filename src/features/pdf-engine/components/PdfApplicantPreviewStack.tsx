/**
 * 사용자 신청서 — 원본 PDF 를 pdf.js 로 세로 적층 렌더하고, 좌표 오버레이를 덮어씌운다.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type MutableRefObject,
  type CSSProperties,
} from 'react'
import type { JSX } from 'react'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import { PDF_APPLICANT_LINE_HEIGHT_FACTOR } from '../lib/pdfApplicantConstants'
import { pdfFontPtToCssPx, pdfPlacementBoxToCss } from '../lib/pdfOverlayLayout'
import type { ApplicantPdfPageViewport as ApplicantVp } from '../lib/pdfApplicantPreviewTypes'
import {
  clampApplicantFontSizePt,
  effectiveApplicantFontSizePt,
  wrapApplicantLines,
  applicantTextFullyFits,
} from '../lib/pdfApplicantTypography'
import { copyPdfBytesForPdfJs } from '../lib/pdfArrayBuffer'
import {
  PdfLoadError,
  describePdfLoadError,
  messageForPdfLoadErrorCode,
  isPdfJsRenderingCancelled,
} from '../lib/pdfErrors'
import { logger } from '../../../lib/logger'
import { getPdfJsCmapAndStandardFontUrls } from '../../../lib/pdfjs/pdfDocumentInitParams'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'
import type { PdfFieldSpec } from '../types'

setupPdfWorker()

const TARGET_PAGE_CSS_WIDTH_PX = 794
const MIN_PAGE_CSS_WIDTH_PX = 260
const MAX_PDF_PREVIEW_DEVICE_PIXEL_RATIO = 3

export type PdfApplicantPreviewHandle = {
  scrollToField: (fieldKey: string) => void
}

function parseCheckboxJson(raw: string): string[] {
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    if (!Array.isArray(p)) return []
    return p.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

type PdfJsPage = Awaited<ReturnType<PDFDocumentProxy['getPage']>>
type PdfPageRenderTask = ReturnType<PdfJsPage['render']>

/**
 * 포커스/강조 스크롤 대상 페이지 — 텍스트는 첫 placement,
 * 라디오/체크박스는 **현재 선택값이 있는 옵션의 placement.page** 를 우선한다.
 */
function pageIndexForApplicantFocus(
  field: PdfFieldSpec | undefined,
  values: Record<string, string>,
): number | null {
  if (!field) return null

  if (field.fieldType === 'radio') {
    const v = values[field.fieldKey] ?? ''
    const pl = field.placements.find((p) => p.optionValue === v)
    if (pl && typeof pl.page === 'number') return pl.page
    return field.placements[0]?.page ?? null
  }

  if (field.fieldType === 'checkbox') {
    const selected = parseCheckboxJson(values[field.fieldKey] ?? '')
    for (const opt of selected) {
      const pl = field.placements.find((p) => p.optionValue === opt)
      if (pl && typeof pl.page === 'number') return pl.page
    }
    return field.placements[0]?.page ?? null
  }

  return field.placements[0]?.page ?? null
}

function assignForwardedRef<F>(forwardedRef: ForwardedRef<F>, node: F | null) {
  if (typeof forwardedRef === 'function') forwardedRef(node)
  else if (forwardedRef) (forwardedRef as MutableRefObject<F | null>).current = node
}

type PageProps = {
  pdfDoc: PDFDocumentProxy
  pageIndex: number
  fields: PdfFieldSpec[]
  values: Record<string, string>
  fontSizeOverrides?: Record<string, number>
  highlightedFieldKey: string | null
  previewInnerWidth: number
  parentScrollRef?: MutableRefObject<HTMLDivElement | null>
  pageAnchorsRef: MutableRefObject<(HTMLDivElement | null)[]>
}

const ApplicantPdfPageRow = forwardRef<HTMLDivElement | null, PageProps>(function ApplicantPdfPageRow(
  {
    pdfDoc,
    pageIndex,
    fields,
    values,
    fontSizeOverrides,
    highlightedFieldKey,
    previewInnerWidth,
    parentScrollRef,
    pageAnchorsRef,
  }: PageProps,
  forwardedRef,
) {
  const layoutHostRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageRenderTaskRef = useRef<PdfPageRenderTask | null>(null)
  const genRef = useRef(0)
  const mergedRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      pageAnchorsRef.current[pageIndex] = node
      assignForwardedRef(forwardedRef, node)
    },
    [forwardedRef, pageAnchorsRef, pageIndex],
  )

  const [viewport, setViewport] = useState<ApplicantVp | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [fatal, setFatal] = useState<string | null>(null)

  useEffect(() => {
    const myGen = ++genRef.current
    let cancelled = false
    setStatus('loading')
    setFatal(null)
    void (async () => {
      try {
        const pageObj = await pdfDoc.getPage(pageIndex + 1)
        if (cancelled || myGen !== genRef.current) return
        const base = pageObj.getViewport({ scale: 1 })
        const hostW = parentScrollRef?.current?.clientWidth ?? layoutHostRef.current?.clientWidth ?? 0
        const innerW =
          hostW > 0 ? hostW : previewInnerWidth > 0 ? previewInnerWidth : TARGET_PAGE_CSS_WIDTH_PX
        const targetCssW = Math.max(MIN_PAGE_CSS_WIDTH_PX, Math.min(TARGET_PAGE_CSS_WIDTH_PX, innerW))
        const scale = targetCssW / base.width
        const vp = pageObj.getViewport({ scale })

        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        if (cancelled || myGen !== genRef.current) return

        const wrap = wrapRef.current
        const canvas = canvasRef.current
        if (!wrap || !canvas) return

        const dpr =
          typeof window !== 'undefined'
            ? Math.min(window.devicePixelRatio || 1, MAX_PDF_PREVIEW_DEVICE_PIXEL_RATIO)
            : 1
        canvas.width = Math.floor(vp.width * dpr)
        canvas.height = Math.floor(vp.height * dpr)
        canvas.style.width = `${vp.width}px`
        canvas.style.height = `${vp.height}px`

        const prevTask = pageRenderTaskRef.current
        if (prevTask) {
          try {
            prevTask.cancel()
          } catch {
            /* noop */
          }
          pageRenderTaskRef.current = null
        }

        const ctx = canvas.getContext('2d')
        if (!ctx) throw new PdfLoadError('page-render-failed', { reason: 'canvas-2d-null' })
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, vp.width, vp.height)
        let task: PdfPageRenderTask | null = null
        try {
          task = pageObj.render({ canvasContext: ctx, viewport: vp, canvas })
          pageRenderTaskRef.current = task
          await task.promise
        } catch (e) {
          if (!isPdfJsRenderingCancelled(e)) throw e
          return
        } finally {
          if (pageRenderTaskRef.current === task) pageRenderTaskRef.current = null
        }

        if (cancelled || myGen !== genRef.current) return
        const vpStruct: ApplicantVp = {
          pageIndex,
          widthPt: base.width,
          heightPt: base.height,
          cssWidthPx: vp.width,
          cssHeightPx: vp.height,
        }
        setViewport(vpStruct)
        setStatus('ready')
      } catch (e) {
        if (cancelled || myGen !== genRef.current) return
        const { code } = describePdfLoadError(e)
        setFatal(messageForPdfLoadErrorCode(code))
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      const t = pageRenderTaskRef.current
      if (t) {
        try {
          t.cancel()
        } catch {
          /* noop */
        }
        pageRenderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageIndex, previewInnerWidth, parentScrollRef])

  const overlays = useMemo(() => {
    if (!viewport) return null
    const out: JSX.Element[] = []
    for (const field of fields) {
      const val = values[field.fieldKey] ?? ''
      const isHi = highlightedFieldKey === field.fieldKey
      let lp = 0
      for (const p of field.placements) {
        lp += 1
        if (p.page !== pageIndex) continue
        const cssBox = pdfPlacementBoxToCss(p, viewport)
        if (cssBox && (field.fieldType === 'text' || field.fieldType === 'textarea')) {
          if (!val.trim() && isHi) {
            out.push(
              <div
                key={`${field.fieldKey}-${lp}-tx-hi`}
                style={{
                  position: 'absolute',
                  left: cssBox.left,
                  top: cssBox.top,
                  width: cssBox.width,
                  height: cssBox.height,
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                  borderRadius: 2,
                  border: '2px solid rgba(59,130,246,0.95)',
                  background: 'rgba(59,130,246,0.08)',
                }}
                aria-hidden
              />,
            )
            continue
          }
          if (!val.trim()) continue
          const fsEff = clampApplicantFontSizePt(effectiveApplicantFontSizePt(field, fontSizeOverrides))
          const mw = p.width != null && p.width > 0 ? p.width : null
          const fontPx = pdfFontPtToCssPx(fsEff, viewport)
          let displayRaw = ''
          if (field.fieldType === 'text') displayRaw = String(val).replace(/\r?\n/g, ' ')
          else displayRaw = String(val)
          const wrapped = wrapApplicantLines(
            field.fieldType === 'text' ? displayRaw.trimEnd().trimStart() : displayRaw,
            fsEff,
            mw,
          )
          const probeForFit =
            field.fieldType === 'text'
              ? String(val).replace(/\r?\n/g, ' ')
              : String(val)
          const exceeds =
            probeForFit.trim().length > 0 && !applicantTextFullyFits(field, fsEff, probeForFit)

          const style: CSSProperties = {
            position: 'absolute',
            left: cssBox.left,
            top: cssBox.top,
            width: cssBox.width,
            height: cssBox.height,
            fontFamily: `'Noto Sans KR', sans-serif`,
            fontSize: fontPx,
            lineHeight: PDF_APPLICANT_LINE_HEIGHT_FACTOR,
            color: '#000',
            overflow: 'hidden',
            pointerEvents: 'none',
            display: field.fieldType === 'text' ? 'flex' : 'block',
            alignItems: field.fieldType === 'text' ? 'center' : 'flex-start',
            justifyContent: field.fieldType === 'text' ? 'center' : 'flex-start',
            textAlign: field.fieldType === 'text' ? 'center' : 'left',
            whiteSpace: field.fieldType === 'text' ? 'nowrap' : 'pre-wrap',
            wordBreak: 'keep-all',
            boxSizing: 'border-box',
            padding: field.fieldType === 'textarea' ? '1px 2px' : 0,
            borderRadius: 2,
            boxShadow:
              isHi && (field.fieldType === 'text' || field.fieldType === 'textarea')
                ? '0 0 0 2px rgba(59,130,246,0.9)'
                : exceeds
                  ? 'inset 0 0 0 1px rgba(239,68,68,0.5)'
                  : undefined,
          }

          const keyPrefix = `${field.fieldKey}-${lp}-txt`

          out.push(
            <div key={keyPrefix} style={style} aria-hidden>
              {field.fieldType === 'text' ? (
                <span style={{ overflow: 'hidden', maxWidth: '100%' }}>
                  {displayRaw.trimEnd().trimStart()}
                </span>
              ) : (
                wrapped.map((ln, li) => (
                  // eslint-disable-next-line react/no-array-index-key -- 순수 줄 표현
                  <span key={li}>
                    {ln}
                    {li + 1 < wrapped.length ? '\n' : null}
                  </span>
                ))
              )}
            </div>,
          )
          continue
        }

        if (cssBox && field.fieldType === 'radio') {
          const ov = p.optionValue
          const sel = Boolean(ov && val === ov)
          if (!sel) {
            /* 선택되지 않은 옵션 좌표에는 라디오 마커를 그리지 않는다 */
            continue
          }
          const dia = Math.min(cssBox.width, cssBox.height) * 0.8
          const hl = isHi
          out.push(
            <div
              key={`${field.fieldKey}-${lp}-r-${ov ?? ''}`}
              style={{
                position: 'absolute',
                left: cssBox.left + (cssBox.width - dia) / 2,
                top: cssBox.top + (cssBox.height - dia) / 2,
                width: dia,
                height: dia,
                borderRadius: '50%',
                pointerEvents: 'none',
                background: '#000',
                border: `${Math.max(0.55, dia * 0.05)}px solid #111`,
                boxShadow: hl ? '0 0 0 2px rgba(59,130,246,0.85)' : undefined,
              }}
              aria-hidden
            />,
          )
          continue
        }

        if (cssBox && field.fieldType === 'checkbox') {
          const ov = p.optionValue
          const sel = ov && parseCheckboxJson(val).includes(ov)
          const markSize = Math.min(cssBox.width, cssBox.height) * 0.85
          const left = cssBox.left + (cssBox.width - markSize) / 2
          const top = cssBox.top + (cssBox.height - markSize) / 2

          if (sel) {
            out.push(
              <svg
                key={`${field.fieldKey}-${lp}-c`}
                width={markSize}
                height={markSize}
                style={{ position: 'absolute', left, top, pointerEvents: 'none' }}
                viewBox={`0 0 ${markSize} ${markSize}`}
                aria-hidden
              >
                <line
                  x1={markSize * 0.1}
                  y1={markSize * 0.5}
                  x2={markSize * 0.4}
                  y2={markSize * 0.15}
                  stroke="#000"
                  strokeWidth={Math.max(1, markSize * 0.12)}
                />
                <line
                  x1={markSize * 0.4}
                  y1={markSize * 0.15}
                  x2={markSize * 0.9}
                  y2={markSize * 0.85}
                  stroke="#000"
                  strokeWidth={Math.max(1, markSize * 0.12)}
                />
              </svg>,
            )
          } else if (isHi && ov) {
            out.push(
              <div
                key={`${field.fieldKey}-${lp}-ch`}
                style={{
                  position: 'absolute',
                  ...cssBox,
                  outline: '2px solid rgba(59,130,246,0.95)',
                  pointerEvents: 'none',
                  borderRadius: 2,
                }}
                aria-hidden
              />,
            )
          }
        }
      }
    }
    return out
  }, [fields, fontSizeOverrides, highlightedFieldKey, pageIndex, values, viewport])

  return (
    <div ref={mergedRefCallback} className="pdf-applicant-preview__page-wrap">
      {status === 'error' ? <p className="pdf-applicant-preview__fatal">{fatal}</p> : null}
      <div ref={layoutHostRef} className="pdf-applicant-preview__canvas-host">
        <div
          ref={wrapRef}
          className="pdf-engine-editor__overlay pdf-engine-editor__overlay--a4-page pdf-applicant-preview__page-inner"
        >
          <canvas ref={canvasRef} className="pdf-applicant-preview__canvas" aria-hidden />
          {viewport ? (
            <div
              className="pdf-applicant-preview__overlay"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              {overlays}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

type StackProps = {
  pdfBuffer: ArrayBuffer | null
  fields: PdfFieldSpec[]
  values: Record<string, string>
  fontSizeOverrides?: Record<string, number>
  highlightedFieldKey: string | null
  className?: string
}

export const PdfApplicantPreviewStack = forwardRef<PdfApplicantPreviewHandle, StackProps>(
  function PdfApplicantPreviewStack(
    { pdfBuffer, fields, values, fontSizeOverrides, highlightedFieldKey, className },
    refOut,
  ) {
    const scrollRootRef = useRef<HTMLDivElement | null>(null)
    const pageAnchorsRef = useRef<(HTMLDivElement | null)[]>([])
    const pdfDocCacheRef = useRef<{ buf: ArrayBuffer; doc: PDFDocumentProxy } | null>(null)
    const loadGenRef = useRef(0)
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
    const [fatal, setFatal] = useState<string | null>(null)
    const [pages, setPages] = useState(1)
    const [innerW, setInnerW] = useState(0)

    useEffect(() => {
      const el = scrollRootRef.current
      if (!el) return
      const obs = new ResizeObserver(() => setInnerW(el.clientWidth))
      obs.observe(el)
      queueMicrotask(() => setInnerW(el.clientWidth))
      return () => obs.disconnect()
    }, [pdfBuffer])

    useEffect(() => {
      if (!pdfBuffer) {
        void pdfDocCacheRef.current?.doc.destroy().catch(() => {})
        pdfDocCacheRef.current = null
        setPdfDoc(null)
        setPages(1)
        setFatal(null)
        return
      }
      const myGen = ++loadGenRef.current
      let cancelled = false
      setFatal(null)
      void (async () => {
        try {
          const cached = pdfDocCacheRef.current
          let doc = cached?.buf === pdfBuffer ? cached.doc : null
          if (!doc) {
            if (cached) void cached.doc.destroy().catch(() => {})
            const pdfJsBytes = copyPdfBytesForPdfJs(pdfBuffer)
            doc = await getDocument({
              data: pdfJsBytes,
              ...getPdfJsCmapAndStandardFontUrls(),
              cMapPacked: true,
              useSystemFonts: true,
              disableFontFace: false,
            }).promise
            pdfDocCacheRef.current = { buf: pdfBuffer, doc }
          }
          if (cancelled || myGen !== loadGenRef.current) return
          setPdfDoc(doc)
          setPages(doc.numPages)
        } catch (e) {
          if (cancelled || myGen !== loadGenRef.current) return
          const { code } = describePdfLoadError(e)
          setFatal(messageForPdfLoadErrorCode(code))
          logger.error('pdf-applicant.preview.load-failed', { code, error: e })
          setPdfDoc(null)
          setPages(1)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [pdfBuffer])

    const scrollToField = useCallback(
      (fieldKey: string) => {
        const field = fields.find((f) => f.fieldKey === fieldKey)
        const piRaw = pageIndexForApplicantFocus(field, values)
        if (piRaw == null || !Number.isFinite(piRaw)) return
        const pi = Math.trunc(piRaw)
        if (pi < 0 || pi >= pages) return
        const el = pageAnchorsRef.current[pi]
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      },
      [fields, pages, values],
    )

    useImperativeHandle(refOut, () => ({ scrollToField }), [scrollToField])

    useEffect(() => {
      if (!highlightedFieldKey) return
      scrollToField(highlightedFieldKey)
    }, [highlightedFieldKey, scrollToField, values])

    if (!pdfBuffer) {
      return <p className="pdf-engine-page__hint">원본 PDF 를 불러오면 미리보기가 표시됩니다.</p>
    }
    if (fatal || !pdfDoc) return <p className="pdf-engine-page__error">{fatal ?? '미리보기 준비 중…'}</p>

    pageAnchorsRef.current = Array.from({ length: pages }, () => null)

    return (
      <div ref={scrollRootRef} className={`pdf-applicant-preview-stack ${className ?? ''}`}>
        {Array.from({ length: pages }, (_, i) => (
          <ApplicantPdfPageRow
            key={i}
            pdfDoc={pdfDoc}
            pageIndex={i}
            fields={fields}
            values={values}
            fontSizeOverrides={fontSizeOverrides}
            highlightedFieldKey={highlightedFieldKey}
            previewInnerWidth={innerW}
            parentScrollRef={scrollRootRef}
            pageAnchorsRef={pageAnchorsRef}
          />
        ))}
      </div>
    )
  },
)
