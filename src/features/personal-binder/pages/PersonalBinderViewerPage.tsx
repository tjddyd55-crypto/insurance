import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import {
  clampNewsDetailViewerZoom,
} from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import { useNewsDetailViewerPan } from '../../../components/news-detail-viewer/useNewsDetailViewerPan'
import { useNewsDetailViewerPinchZoom } from '../../../components/news-detail-viewer/useNewsDetailViewerPinchZoom'
import {
  useNewsDetailViewerZoomAnchor,
  type NewsDetailViewerZoomAnchor,
} from '../../../components/news-detail-viewer/useNewsDetailViewerZoomAnchor'
import { getPdfJsCmapAndStandardFontUrls } from '../../../lib/pdfjs/pdfDocumentInitParams'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'
import { useAuth } from '../../auth/AuthProvider'
import {
  createStorageFileDownloadUrl,
  createStorageFilePreviewUrl,
} from '../../storage/api/storageApi'
import { BinderPdfPageCanvas } from '../components/BinderPdfCanvas'
import { buildBinderViewerPages } from '../domain/pageSelection'
import { getPersonalBinder } from '../personalBinder.api'
import {
  downloadPersonalBinderPdf,
  printPersonalBinderPdf,
} from '../personalBinderPdf'
import type {
  PersonalBinder,
  PersonalBinderMaterial,
} from '../personalBinder.types'
import '../styles/personal-binder.css'

setupPdfWorker()

type CachedDocument = {
  document: PDFDocumentProxy
  url: string
}

export default function PersonalBinderViewerPage() {
  const { binderId = '' } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [binder, setBinder] = useState<PersonalBinder | null>(null)
  const [index, setIndex] = useState(0)
  const [frame, setFrame] = useState<{
    materialId: string
    document: PDFDocumentProxy
    pageNumber: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tocOpen, setTocOpen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const zoomAnchorRef = useRef<NewsDetailViewerZoomAnchor>(null)
  const cacheRef = useRef<Map<string, Promise<CachedDocument>>>(new Map())
  const loadedRef = useRef<Map<string, CachedDocument>>(new Map())

  const pages = useMemo(
    () => binder ? buildBinderViewerPages(binder) : [],
    [binder],
  )
  const current = pages[index] ?? null

  const setViewerZoom = useCallback((next: number) => {
    setZoom((value) => {
      const clamped = Math.max(1, clampNewsDetailViewerZoom(next))
      return Math.abs(value - clamped) < 0.001 ? value : clamped
    })
  }, [])

  useNewsDetailViewerPinchZoom(
    viewportRef,
    zoom,
    setViewerZoom,
    true,
    zoomAnchorRef,
  )
  useNewsDetailViewerZoomAnchor(viewportRef, zoom, zoomAnchorRef)
  useNewsDetailViewerPan(viewportRef, zoom, true)

  useEffect(() => {
    if (!token || !binderId) return
    const controller = new AbortController()
    void (async () => {
      try {
        const next = await getPersonalBinder(token, binderId, controller.signal)
        setBinder(next)
        setLoading(false)
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : '바인더를 불러오지 못했습니다.')
          setLoading(false)
        }
      }
    })()
    return () => controller.abort()
  }, [binderId, token])

  const loadMaterial = useCallback(async (
    material: PersonalBinderMaterial,
  ): Promise<CachedDocument> => {
    const cached = cacheRef.current.get(material.id)
    if (cached) return cached
    if (!token) throw new Error('로그인이 필요합니다.')
    const promise = (async () => {
      const url = await createStorageFilePreviewUrl(token, material.fileId)
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      const resources = getPdfJsCmapAndStandardFontUrls()
      const document = await getDocument({
        data: bytes,
        ...resources,
        cMapPacked: true,
        useSystemFonts: true,
        disableFontFace: false,
      }).promise
      const entry = { document, url }
      loadedRef.current.set(material.id, entry)
      return entry
    })()
    cacheRef.current.set(material.id, promise)
    return promise
  }, [token])

  const displayFrame = useMemo(() => {
    if (!current) return null
    const cached = loadedRef.current.get(current.material.id)
    if (cached) {
      return {
        materialId: current.material.id,
        document: cached.document,
        pageNumber: current.pdfPageNumber,
      }
    }
    return frame
  }, [current, frame])

  useEffect(() => {
    if (!current) return undefined
    const materialId = current.material.id
    const pageNumber = current.pdfPageNumber
    const cached = loadedRef.current.get(materialId)
    if (cached) {
      setFrame((previous) => {
        if (
          previous?.materialId === materialId &&
          previous.document === cached.document &&
          previous.pageNumber === pageNumber
        ) {
          return previous
        }
        return { materialId, document: cached.document, pageNumber }
      })
      return undefined
    }
    let cancelled = false
    setError('')
    void loadMaterial(current.material)
      .then((entry) => {
        if (cancelled) return
        setFrame({ materialId, document: entry.document, pageNumber })
      })
      .catch(() => {
        if (!cancelled) setError('PDF 페이지를 불러오지 못했습니다.')
      })
    return () => {
      cancelled = true
    }
    // 같은 자료의 다음 페이지는 캐시된 PDFDocument를 유지한다. null로 비우지 않는다.
  }, [current, loadMaterial])

  useEffect(() => {
    if (!current?.key) return
    setZoom(1)
    viewportRef.current?.scrollTo({ left: 0, top: 0 })
  }, [current?.key])

  useEffect(() => {
    for (const neighborIndex of [index - 1, index + 1, index + 2]) {
      const neighbor = pages[neighborIndex]
      if (neighbor) void loadMaterial(neighbor.material).catch(() => {})
    }
  }, [index, loadMaterial, pages])

  useEffect(() => () => {
    for (const entry of loadedRef.current.values()) {
      void entry.document.destroy()
    }
    loadedRef.current.clear()
    cacheRef.current.clear()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
      if (event.key === 'ArrowRight') {
        setIndex((value) => Math.min(Math.max(0, pages.length - 1), value + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pages.length])

  if (!token) return <Navigate to="/login" replace />
  if (loading) return <main className="personal-binder-viewer-status">상담 책자를 준비하는 중…</main>
  if (!binder || pages.length === 0) {
    return (
      <main className="personal-binder-viewer-status">
        <p>{error || '상담할 페이지가 없습니다.'}</p>
        <FormButton variant="secondary" onClick={() => navigate(`/personal-binders/${binderId}/edit`)}>
          편집으로
        </FormButton>
      </main>
    )
  }

  const move = (direction: -1 | 1) => {
    setIndex((value) => Math.min(pages.length - 1, Math.max(0, value + direction)))
  }
  const jumpToSection = (sectionId: string) => {
    const next = pages.findIndex((page) => page.sectionId === sectionId)
    if (next >= 0) setIndex(next)
    setTocOpen(false)
  }
  const downloadCurrent = async () => {
    if (!current) return
    const url = await createStorageFileDownloadUrl(token, current.material.fileId)
    window.location.assign(url)
  }
  const printCurrent = async () => {
    if (!current) return
    const entry = await loadMaterial(current.material)
    const opened = window.open(entry.url, '_blank')
    if (opened) opened.opener = null
    window.setTimeout(() => opened?.print(), 1000)
  }
  const exportBinder = async (mode: 'download' | 'print') => {
    if (!binder || exporting) return
    setExporting(true)
    setError('')
    try {
      if (mode === 'download') {
        await downloadPersonalBinderPdf(token, binder.id, binder.title)
      } else {
        await printPersonalBinderPdf(token, binder.id)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '바인더 PDF를 만들지 못했습니다.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main
      className={[
        'personal-binder-viewer',
        controlsVisible ? '' : 'personal-binder-viewer--immersive',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="personal-binder-viewer__header">
        <FormButton
          variant="action"
          aria-label="편집으로"
          onClick={() => navigate(`/personal-binders/${binder.id}/edit`)}
        >
          ←
        </FormButton>
        <div>
          <strong>{binder.title}</strong>
          <span>{current?.sectionTitle}</span>
        </div>
        <FormButton variant="action" onClick={() => setTocOpen(true)}>목차</FormButton>
      </header>
      {error ? <p className="personal-binder-error">{error}</p> : null}

      <div
        ref={viewportRef}
        className={[
          'personal-binder-viewer__viewport',
          zoom > 1 ? 'personal-binder-viewer__viewport--zoomed' : '',
        ].filter(Boolean).join(' ')}
        onPointerDown={(event) => {
          if (zoom !== 1 || event.button !== 0) return
          swipeStartRef.current = { x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          swipeStartRef.current = null
        }}
        onPointerUp={(event) => {
          const start = swipeStartRef.current
          swipeStartRef.current = null
          if (!start || zoom !== 1) return
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            move(dx < 0 ? 1 : -1)
          } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
            setControlsVisible((visible) => !visible)
          }
        }}
      >
        {displayFrame ? (
          <BinderPdfPageCanvas
            document={displayFrame.document}
            pageNumber={displayFrame.pageNumber}
            zoom={zoom}
            className="personal-binder-viewer__page"
            onError={() => setError('페이지를 표시하지 못했습니다.')}
          />
        ) : (
          <div className="personal-binder-viewer-status">
            {error || '페이지를 불러오는 중…'}
          </div>
        )}
      </div>

      <footer className="personal-binder-viewer__controls">
        <FormButton variant="action" aria-label="이전 페이지" disabled={index === 0} onClick={() => move(-1)}>‹</FormButton>
        <div>
          <strong>{index + 1} / {pages.length}</strong>
          <span>{current?.sectionTitle}</span>
        </div>
        <FormButton variant="action" aria-label="다음 페이지" disabled={index === pages.length - 1} onClick={() => move(1)}>›</FormButton>
        <FormButton variant="action" onClick={() => setViewerZoom(Math.max(1, zoom - 0.25))}>축소</FormButton>
        <FormButton variant="action" onClick={() => setViewerZoom(zoom + 0.25)}>확대</FormButton>
        <FormButton variant="action" onClick={() => setViewerZoom(1)}>폭 맞춤</FormButton>
        <FormButton variant="secondary" onClick={() => void downloadCurrent()}>원본 다운로드</FormButton>
        <FormButton variant="secondary" onClick={() => void printCurrent()}>자료 출력</FormButton>
        <FormButton variant="secondary" loading={exporting} onClick={() => void exportBinder('download')}>전체 PDF</FormButton>
        <FormButton variant="secondary" loading={exporting} onClick={() => void exportBinder('print')}>전체 출력</FormButton>
      </footer>

      <BaseDialog
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        ariaLabel="바인더 목차"
        closeOnBackdrop={false}
      >
        <h2 className="personal-binder-dialog-title">목차</h2>
        <div className="personal-binder-viewer__toc">
          {binder.sections.map((section) => (
            <FormButton
              key={section.id}
              variant={section.id === current?.sectionId ? 'primary' : 'action'}
              onClick={() => jumpToSection(section.id)}
            >
              {section.title}
            </FormButton>
          ))}
        </div>
        <div className="personal-binder-dialog-actions">
          <FormButton variant="secondary" onClick={() => setTocOpen(false)}>닫기</FormButton>
        </div>
      </BaseDialog>
    </main>
  )
}
