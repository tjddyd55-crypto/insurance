import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

import FormButton from '../../../components/form/FormButton'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'

setupPdfWorker()

type PageCanvasProps = {
  document: PDFDocumentProxy
  pageNumber: number
  zoom?: number
  className?: string
  onError?: () => void
}

export function BinderPdfPageCanvas({
  document,
  pageNumber,
  zoom = 1,
  className = '',
  onError,
}: PageCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const taskRef = useRef<RenderTask | null>(null)
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
    if (!canvas || hostWidth <= 0) return undefined
    let cancelled = false
    void (async () => {
      try {
        taskRef.current?.cancel()
        const page = await document.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = Math.max(0.1, (hostWidth / base.width) * zoom)
        const viewport = page.getViewport({ scale })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.ceil(viewport.width * dpr)
        canvas.height = Math.ceil(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const context = canvas.getContext('2d')
        if (!context) throw new Error('canvas unavailable')
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        context.fillStyle = 'white'
        context.fillRect(0, 0, viewport.width, viewport.height)
        const task = page.render({ canvas, canvasContext: context, viewport })
        taskRef.current = task
        await task.promise
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
  }, [document, hostWidth, onError, pageNumber, zoom])

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
      <FormButton
        variant="action"
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
        <canvas ref={canvasRef} />
        <span>{pageNumber}</span>
        {selected ? <strong aria-hidden="true">✓</strong> : null}
      </FormButton>
    </div>
  )
}
