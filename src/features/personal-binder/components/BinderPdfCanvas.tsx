import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'
import {
  computeBinderPdfDisplayScale,
  type BinderPdfViewerFitMode,
} from '../domain/binderPdfViewerScale'

setupPdfWorker()

const VIEWER_CANVAS_PADDING = 16

type PageCanvasProps = {
  document: PDFDocumentProxy
  pageNumber: number
  zoom?: number
  fit?: BinderPdfViewerFitMode
  containerWidth?: number
  containerHeight?: number
  className?: string
  onError?: () => void
}

export function BinderPdfPageCanvas({
  document,
  pageNumber,
  zoom = 1,
  fit = 'width',
  containerWidth = 0,
  containerHeight = 0,
  className = '',
  onError,
}: PageCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const taskRef = useRef<RenderTask | null>(null)
  const renderGenerationRef = useRef(0)
  const [hostWidth, setHostWidth] = useState(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const measure = () => {
      const width = host.clientWidth
      setHostWidth((current) => Math.abs(current - width) < 1 ? current : width)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const layoutWidth = containerWidth > 0 ? containerWidth : hostWidth
    if (!canvas || layoutWidth <= 0) return undefined
    let cancelled = false
    const generation = ++renderGenerationRef.current
    void (async () => {
      try {
        taskRef.current?.cancel()
        const page = await document.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = computeBinderPdfDisplayScale({
          pageWidth: base.width,
          pageHeight: base.height,
          containerWidth: layoutWidth,
          containerHeight: containerHeight > 0 ? containerHeight : layoutWidth,
          fit,
          zoom,
          padding: VIEWER_CANVAS_PADDING,
        })
        const viewport = page.getViewport({ scale })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const pixelWidth = Math.ceil(viewport.width * dpr)
        const pixelHeight = Math.ceil(viewport.height * dpr)

        const buffer = window.document.createElement('canvas')
        buffer.width = pixelWidth
        buffer.height = pixelHeight
        const bufferContext = buffer.getContext('2d')
        if (!bufferContext) throw new Error('canvas unavailable')
        bufferContext.setTransform(dpr, 0, 0, dpr, 0, 0)
        bufferContext.fillStyle = 'white'
        bufferContext.fillRect(0, 0, viewport.width, viewport.height)

        const task = page.render({ canvas: buffer, canvasContext: bufferContext, viewport })
        taskRef.current = task
        await task.promise
        if (cancelled || generation !== renderGenerationRef.current) return

        const context = canvas.getContext('2d')
        if (!context) throw new Error('canvas unavailable')
        canvas.width = pixelWidth
        canvas.height = pixelHeight
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.drawImage(buffer, 0, 0)
      } catch (error) {
        if (!cancelled && (error as { name?: string }).name !== 'RenderingCancelledException') {
          onError?.()
        }
      }
    })()
    return () => {
      cancelled = true
      taskRef.current?.cancel()
      taskRef.current = null
    }
  }, [containerHeight, containerWidth, document, fit, hostWidth, onError, pageNumber, zoom])

  return (
    <div
      ref={hostRef}
      className={['personal-binder-pdf-canvas', className].filter(Boolean).join(' ')}
    >
      <canvas ref={canvasRef} aria-label={`${pageNumber}페이지 미리보기`} />
    </div>
  )
}

export function BinderPdfThumbnail({
  document,
  pageNumber,
  selected,
  current,
  priority = false,
  onClick,
}: {
  document: PDFDocumentProxy
  pageNumber: number
  selected: boolean
  current: boolean
  priority?: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const slotRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const taskRef = useRef<RenderTask | null>(null)
  const [visible, setVisible] = useState(priority)
  const shouldRender = priority || visible

  useEffect(() => {
    const slot = slotRef.current
    if (!slot) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: slot.closest('.personal-binder-page-panel, .personal-binder-page-dialog__mobile-thumbnails'), rootMargin: '160px' },
    )
    observer.observe(slot)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !shouldRender) {
      taskRef.current?.cancel()
      taskRef.current = null
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      return undefined
    }
    let cancelled = false
    void (async () => {
      try {
        const page = await document.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 72 / base.width })
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
        canvas.width = Math.ceil(viewport.width * dpr)
        canvas.height = Math.ceil(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const context = canvas.getContext('2d')
        if (!context) return
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        const task = page.render({ canvas, canvasContext: context, viewport })
        taskRef.current = task
        await task.promise
      } catch (error) {
        if ((error as { name?: string }).name !== 'RenderingCancelledException') {
          canvas.dataset.renderError = 'true'
        }
      }
    })()
    return () => {
      cancelled = true
      taskRef.current?.cancel()
    }
  }, [document, pageNumber, shouldRender])

  return (
    <div ref={slotRef} className="personal-binder-thumbnail-slot" data-binder-page={pageNumber}>
      <button
        type="button"
        className={[
          'personal-binder-thumbnail',
          selected ? 'personal-binder-thumbnail--selected' : '',
          current ? 'personal-binder-thumbnail--current' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        aria-pressed={selected}
        aria-current={current ? 'true' : undefined}
        aria-label={`${pageNumber}페이지${selected ? ' 선택됨' : ''}`}
      >
        <span className="personal-binder-thumbnail__media">
          <canvas ref={canvasRef} />
        </span>
        <span className="personal-binder-thumbnail__page">{pageNumber}</span>
        {selected ? <strong className="personal-binder-thumbnail__check" aria-hidden="true">✓</strong> : null}
      </button>
    </div>
  )
}
