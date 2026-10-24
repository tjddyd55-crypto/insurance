import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { EmptyState } from '../../../components/feedback/EmptyState'
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
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { BINDER_EMPTY_SECTION_MESSAGE, binderTocSectionAction } from '../domain/binderToc'
import type { BinderPdfViewerFitMode } from '../domain/binderPdfViewerScale'
import {
  createStorageFileDownloadUrl,
  createStorageFilePreviewUrl,
} from '../../storage/api/storageApi'
import {
  BinderConsultationPageContent,
  BinderConsultationPageError,
} from '../components/BinderConsultationPageContent'
import { buildBinderViewerPages } from '../domain/pageSelection'
import { formatBinderViewerZoomPercent, stepBinderViewerZoom } from '../domain/binderViewerZoom'
import {
  isBinderImageMaterial,
  resolveBinderMaterialRenderKind,
} from '../utils/binderFileDisplay'
import {
  mapSharedDetailToPersonalBinder,
  resolveSharedBinderShareFileId,
} from '../domain/mapSharedDetailToPersonalBinder'
import { getPersonalBinder } from '../personalBinder.api'
import {
  fetchSharedBinderFileBlob,
  getSharedPersonalBinder,
} from '../personalBinderShare.api'
import type {
  PersonalBinder,
  PersonalBinderMaterial,
} from '../personalBinder.types'
import '../styles/personal-binder.css'

setupPdfWorker()

type CachedMaterial =
  | { kind: 'pdf'; document: PDFDocumentProxy; url: string }
  | { kind: 'image'; url: string }

type ViewerFrame =
  | {
    materialId: string
    kind: 'pdf'
    document: PDFDocumentProxy
    pageNumber: number
  }
  | {
    materialId: string
    kind: 'image'
    url: string
  }

type PageLoadError = {
  pageKey: string
  message: string
}

export default function PersonalBinderViewerPage() {
  const { binderId = '', shareId = '' } = useParams()
  const isSharedView = Boolean(shareId)
  const activeShareId = shareId
  const { token } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const viewerReturn = location.state as { returnTo?: string; scrollY?: number } | null
  const [binder, setBinder] = useState<PersonalBinder | null>(null)
  const [index, setIndex] = useState(0)
  const [frame, setFrame] = useState<ViewerFrame | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageLoadError, setPageLoadError] = useState<PageLoadError | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [tocEmptyNotice, setTocEmptyNotice] = useState<string | null>(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  // 슬라이드 쇼는 보기 전용: 맞춤 방식은 기기 기준 고정(모바일 폭 / PC 쪽).
  const fitMode: BinderPdfViewerFitMode = isMobile ? 'width' : 'page'
  const [zoom, setZoom] = useState(1)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const zoomAnchorRef = useRef<NewsDetailViewerZoomAnchor>(null)
  const cacheRef = useRef<Map<string, Promise<CachedMaterial>>>(new Map())
  const loadedRef = useRef<Map<string, CachedMaterial>>(new Map())
  const objectUrlRef = useRef<Set<string>>(new Set())

  const pages = useMemo(
    () => binder ? buildBinderViewerPages(binder) : [],
    [binder],
  )
  const current = pages[index] ?? null

  const setViewerZoom = useCallback((next: number) => {
    setZoom((value) => {
      const clamped = clampNewsDetailViewerZoom(next)
      return Math.abs(value - clamped) < 0.001 ? value : clamped
    })
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const measure = () => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
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
    if (!token) return
    if (!isSharedView && !binderId) return
    if (isSharedView && !activeShareId) return
    const controller = new AbortController()
    void (async () => {
      try {
        const next = isSharedView
          ? mapSharedDetailToPersonalBinder(
            await getSharedPersonalBinder(token, activeShareId, controller.signal),
          )
          : await getPersonalBinder(token, binderId, controller.signal)
        setBinder(next)
        setLoading(false)
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(
            reason instanceof Error
              ? reason.message
              : isSharedView
                ? '공유 바인더를 불러오지 못했습니다.'
                : '바인더를 불러오지 못했습니다.',
          )
          setLoading(false)
        }
      }
    })()
    return () => controller.abort()
  }, [activeShareId, binderId, isSharedView, token])

  const pageLoadErrorMessage = useCallback((material: PersonalBinderMaterial, reason: unknown) => {
    const kind = resolveBinderMaterialRenderKind(material)
    if (reason instanceof Error && /^HTTP \d+/.test(reason.message)) {
      return kind === 'image'
        ? '이미지를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
        : 'PDF를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
    }
    return kind === 'image'
      ? '이미지 페이지를 표시하지 못했습니다.'
      : 'PDF 페이지를 불러오지 못했습니다.'
  }, [])

  const trackObjectUrl = useCallback((url: string) => {
    if (url.startsWith('blob:')) {
      objectUrlRef.current.add(url)
    }
  }, [])

  const loadMaterial = useCallback(async (
    material: PersonalBinderMaterial,
  ): Promise<CachedMaterial> => {
    const cached = cacheRef.current.get(material.id)
    if (cached) return cached
    if (!token) throw new Error('로그인이 필요합니다.')
    const promise = (async () => {
      const kind = resolveBinderMaterialRenderKind(material)
      let url: string
      let bytes: Uint8Array
      if (isSharedView) {
        const shareFileId = resolveSharedBinderShareFileId(material)
        const blob = await fetchSharedBinderFileBlob(token, activeShareId, shareFileId)
        url = URL.createObjectURL(blob)
        trackObjectUrl(url)
        bytes = new Uint8Array(await blob.arrayBuffer())
      } else {
        url = await createStorageFilePreviewUrl(token, material.fileId)
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        bytes = new Uint8Array(await response.arrayBuffer())
      }
      if (kind === 'image') {
        const entry: CachedMaterial = { kind: 'image', url }
        loadedRef.current.set(material.id, entry)
        return entry
      }
      const resources = getPdfJsCmapAndStandardFontUrls()
      const document = await getDocument({
        data: bytes,
        ...resources,
        cMapPacked: true,
        useSystemFonts: true,
        disableFontFace: false,
      }).promise
      const entry: CachedMaterial = { kind: 'pdf', document, url }
      loadedRef.current.set(material.id, entry)
      return entry
    })()
    cacheRef.current.set(material.id, promise)
    return promise
  }, [activeShareId, isSharedView, token, trackObjectUrl])

  const invalidateMaterialCache = useCallback((materialId: string) => {
    const loaded = loadedRef.current.get(materialId)
    if (loaded?.kind === 'pdf') void loaded.document.destroy()
    if (loaded?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(loaded.url)
      objectUrlRef.current.delete(loaded.url)
    }
    loadedRef.current.delete(materialId)
    cacheRef.current.delete(materialId)
  }, [])

  const displayFrame = useMemo((): ViewerFrame | null => {
    if (!current) return null
    const cached = loadedRef.current.get(current.material.id)
    if (cached?.kind === 'pdf') {
      return {
        materialId: current.material.id,
        kind: 'pdf',
        document: cached.document,
        pageNumber: current.pdfPageNumber,
      }
    }
    if (cached?.kind === 'image') {
      return {
        materialId: current.material.id,
        kind: 'image',
        url: cached.url,
      }
    }
    return frame
  }, [current, frame])

  useEffect(() => {
    if (!current) return undefined
    setPageLoadError(null)
    const material = current.material
    const materialId = material.id
    const pageNumber = current.pdfPageNumber
    const cached = loadedRef.current.get(materialId)
    if (cached?.kind === 'pdf') {
      setFrame((previous) => {
        if (
          previous?.materialId === materialId &&
          previous.kind === 'pdf' &&
          previous.document === cached.document &&
          previous.pageNumber === pageNumber
        ) {
          return previous
        }
        return { materialId, kind: 'pdf', document: cached.document, pageNumber }
      })
      return undefined
    }
    if (cached?.kind === 'image') {
      setFrame((previous) => {
        if (previous?.materialId === materialId && previous.kind === 'image' && previous.url === cached.url) {
          return previous
        }
        return { materialId, kind: 'image', url: cached.url }
      })
      return undefined
    }
    let cancelled = false
    void loadMaterial(material)
      .then((entry) => {
        if (cancelled) return
        if (entry.kind === 'image') {
          setFrame({ materialId, kind: 'image', url: entry.url })
          return
        }
        setFrame({ materialId, kind: 'pdf', document: entry.document, pageNumber })
      })
      .catch((reason) => {
        if (cancelled || !current) return
        console.error('[personal-binder-viewer] material load failed', {
          materialId,
          fileId: material.fileId,
          kind: resolveBinderMaterialRenderKind(material),
          reason,
        })
        setPageLoadError({
          pageKey: current.key,
          message: pageLoadErrorMessage(material, reason),
        })
        setFrame(null)
      })
    return () => {
      cancelled = true
    }
    // 같은 자료의 다음 페이지는 캐시된 PDFDocument를 유지한다. null로 비우지 않는다.
  }, [current, loadMaterial, pageLoadErrorMessage])

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
      if (entry.kind === 'pdf') void entry.document.destroy()
      if (entry.url?.startsWith('blob:')) {
        URL.revokeObjectURL(entry.url)
      }
    }
    for (const url of objectUrlRef.current) {
      URL.revokeObjectURL(url)
    }
    objectUrlRef.current.clear()
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
  if (loading) return <main className="personal-binder-viewer-status">슬라이드 쇼를 준비하는 중…</main>
  if (!binder || pages.length === 0) {
    return (
      <main className="personal-binder-viewer-status">
        <p>{error || '슬라이드 쇼로 볼 페이지가 없습니다.'}</p>
        <FormButton
          variant="secondary"
          onClick={() => {
            const returnTo = viewerReturn?.returnTo ?? (
              isSharedView ? '/personal-binders/shared' : `/personal-binders/${binderId}/edit`
            )
            navigate(returnTo, {
              state: viewerReturn?.scrollY != null ? { restoreScrollY: viewerReturn.scrollY } : undefined,
            })
          }}
        >
          편집으로
        </FormButton>
      </main>
    )
  }

  const move = (direction: -1 | 1) => {
    setIndex((value) => Math.min(pages.length - 1, Math.max(0, value + direction)))
  }
  const jumpToSection = (sectionId: string) => {
    const section = binder?.sections.find((row) => row.id === sectionId)
    const itemCount = section?.items.length ?? 0
    if (binderTocSectionAction(itemCount) === 'empty') {
      setTocEmptyNotice(BINDER_EMPTY_SECTION_MESSAGE)
      return
    }
    setTocEmptyNotice(null)
    const next = pages.findIndex((page) => page.sectionId === sectionId)
    if (next >= 0) setIndex(next)
    setTocOpen(false)
  }
  const downloadCurrent = async () => {
    if (!current || !token) return
    if (isSharedView) {
      const shareFileId = resolveSharedBinderShareFileId(current.material)
      const blob = await fetchSharedBinderFileBlob(token, activeShareId, shareFileId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = current.material.originalFileName || 'download'
      anchor.rel = 'noopener'
      anchor.click()
      URL.revokeObjectURL(url)
      return
    }
    const url = await createStorageFileDownloadUrl(token, current.material.fileId)
    window.location.assign(url)
  }

  const retryCurrentPage = () => {
    if (!current) return
    invalidateMaterialCache(current.material.id)
    setPageLoadError(null)
    setFrame(null)
    void loadMaterial(current.material)
      .then((entry) => {
        if (entry.kind === 'image') {
          setFrame({ materialId: current.material.id, kind: 'image', url: entry.url })
          return
        }
        setFrame({
          materialId: current.material.id,
          kind: 'pdf',
          document: entry.document,
          pageNumber: current.pdfPageNumber,
        })
      })
      .catch((reason) => {
        setPageLoadError({
          pageKey: current.key,
          message: pageLoadErrorMessage(current.material, reason),
        })
      })
  }
  const exitViewer = () => {
    const returnTo = viewerReturn?.returnTo ?? (
      isSharedView ? '/personal-binders/shared' : `/personal-binders/${binder.id}/edit`
    )
    navigate(returnTo, {
      state: viewerReturn?.scrollY != null ? { restoreScrollY: viewerReturn.scrollY } : undefined,
    })
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
          aria-label={isSharedView ? '공유 목록으로' : '편집으로'}
          onClick={() => exitViewer()}
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
        {pageLoadError?.pageKey === current?.key ? (
          <BinderConsultationPageError
            message={pageLoadError.message}
            materialTitle={current?.material.title}
            onRetry={retryCurrentPage}
          />
        ) : displayFrame ? (
          <BinderConsultationPageContent
            kind={displayFrame.kind}
            document={displayFrame.kind === 'pdf' ? displayFrame.document : undefined}
            pageNumber={displayFrame.kind === 'pdf' ? displayFrame.pageNumber : 1}
            imageUrl={displayFrame.kind === 'image' ? displayFrame.url : undefined}
            imageAlt={current?.material.title ?? ''}
            fit={fitMode}
            zoom={zoom}
            containerWidth={viewportSize.width}
            containerHeight={viewportSize.height}
            className="personal-binder-viewer__page"
            onRenderError={() => {
              if (!current) return
              setPageLoadError({
                pageKey: current.key,
                message: isBinderImageMaterial(current.material)
                  ? '이미지 페이지를 표시하지 못했습니다.'
                  : '페이지를 표시하지 못했습니다.',
              })
            }}
          />
        ) : (
          <div className="personal-binder-viewer-status">페이지를 불러오는 중…</div>
        )}
      </div>

      <footer className="personal-binder-viewer__controls">
        <FormButton variant="action" aria-label="이전 페이지" disabled={index === 0} onClick={() => move(-1)}>‹</FormButton>
        <div>
          <strong>{index + 1} / {pages.length}</strong>
          <span>{current?.sectionTitle}</span>
        </div>
        <FormButton variant="action" aria-label="다음 페이지" disabled={index === pages.length - 1} onClick={() => move(1)}>›</FormButton>
        <FormButton variant="action" aria-label="축소" onClick={() => setViewerZoom(stepBinderViewerZoom(zoom, -1))}>축소</FormButton>
        <span className="personal-binder-viewer__zoom" aria-live="polite">{formatBinderViewerZoomPercent(zoom)}</span>
        <FormButton variant="action" aria-label="확대" onClick={() => setViewerZoom(stepBinderViewerZoom(zoom, 1))}>확대</FormButton>
        <FormButton variant="secondary" onClick={() => void downloadCurrent()}>원본 다운로드</FormButton>
      </footer>

      <BaseDialog
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        ariaLabel="바인더 목차"
        closeOnBackdrop={false}
      >
        <h2 className="personal-binder-dialog-title">목차</h2>
        {tocEmptyNotice ? <EmptyState message={tocEmptyNotice} /> : null}
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
