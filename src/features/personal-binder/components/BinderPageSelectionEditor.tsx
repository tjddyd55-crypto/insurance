import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
} from 'react'

import { useConfirmDialog } from '../../../components/dialog'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import {
  formatSelectedPages,
  normalizeSelectedPages,
  parsePageRangeInput,
  togglePageSelection,
} from '../domain/pageSelection'
import { useBinderPdfDocument } from '../hooks/useBinderPdfDocument'
import type { PersonalBinder, PersonalBinderMaterial } from '../personalBinder.types'
import { splitBinderFileDisplayName } from '../utils/binderFileDisplay'
import { BinderPdfPageCanvas, BinderPdfThumbnail } from './BinderPdfCanvas'

export type BinderPageSelectionEditorHandle = {
  requestClose: () => Promise<boolean>
}

export type BinderPageSelectionEditorProps = {
  active: boolean
  variant: 'desktop' | 'mobile'
  presentation: 'modal' | 'panel'
  binder: PersonalBinder
  folderLabel: string
  sectionTitle: string
  material: PersonalBinderMaterial | null
  pdfUrl: string | null
  initialSelection: number[] | null
  onClose: () => void
  onComplete: (selection: number[] | null) => void
}

export const BinderPageSelectionEditor = forwardRef<
  BinderPageSelectionEditorHandle,
  BinderPageSelectionEditorProps
>(function BinderPageSelectionEditor(
  {
    active,
    variant,
    presentation,
    binder,
    folderLabel,
    sectionTitle,
    material,
    pdfUrl,
    initialSelection,
    onClose,
    onComplete,
  },
  ref,
) {
  const isMobile = variant === 'mobile'
  const { confirm, confirmDialog } = useConfirmDialog()
  const rootRef = useRef<HTMLDivElement>(null)
  const isImageMaterial =
    material?.mimeType != null && material.mimeType.toLowerCase().startsWith('image/')
  const pdf = useBinderPdfDocument(active && !isImageMaterial ? pdfUrl : null)
  const [mode, setMode] = useState<'all' | 'partial'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])
  const [rangeInput, setRangeInput] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [zoom, setZoom] = useState(1)
  const lastSelectedRef = useRef<number | null>(null)
  const swipeStartRef = useRef<number | null>(null)
  const initialKeyRef = useRef('')

  useEffect(() => {
    if (!active || !material) return
    const frame = requestAnimationFrame(() => {
      const next =
        initialSelection == null
          ? []
          : normalizeSelectedPages(initialSelection, material.pageCount)
      setMode(initialSelection == null ? 'all' : 'partial')
      setSelected(next)
      setRangeInput(formatSelectedPages(next))
      setRangeError('')
      setCurrentPage(1)
      setZoom(1)
      lastSelectedRef.current = null
      initialKeyRef.current = `${initialSelection == null ? 'all' : 'partial'}:${formatSelectedPages(next)}`
    })
    return () => cancelAnimationFrame(frame)
  }, [active, initialSelection, material])

  useEffect(() => {
    if (!active) return
    rootRef.current
      ?.querySelector(`[data-binder-page="${currentPage}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [active, currentPage])

  const requestClose = async (): Promise<boolean> => {
    if (!material) return true
    const currentKey = `${mode}:${mode === 'partial' ? formatSelectedPages(selected) : ''}`
    const openedKey = initialKeyRef.current
    const dirty = openedKey !== '' && currentKey !== openedKey
    if (dirty) {
      const accepted = await confirm({
        title: '페이지 선택을 닫을까요?',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
        confirmLabel: '닫기',
        cancelLabel: '계속 편집',
      })
      if (!accepted) return false
    }
    onClose()
    return true
  }

  useImperativeHandle(ref, () => ({ requestClose }), [confirm, mode, onClose, selected])

  if (!active || !material) return null

  const pageCount = material.pageCount
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
  const usedPageCount =
    initialSelection == null ? pageCount : normalizeSelectedPages(initialSelection, pageCount).length

  const setPartialSelection = (next: number[]) => {
    const normalized = normalizeSelectedPages(next, pageCount)
    setSelected(normalized)
    setRangeInput(formatSelectedPages(normalized))
    setRangeError('')
  }

  const handlePageClick = (page: number, event: MouseEvent<HTMLButtonElement>) => {
    setCurrentPage(page)
    if (mode !== 'partial') return
    const next = togglePageSelection(selected, page, {
      additive: true,
      shiftFrom: !isMobile && event.shiftKey ? lastSelectedRef.current : null,
    })
    if (!event.shiftKey) lastSelectedRef.current = page
    setPartialSelection(next)
  }

  const applyRange = () => {
    const parsed = parsePageRangeInput(rangeInput, pageCount)
    if (!parsed.ok) {
      setRangeError(parsed.error)
      return
    }
    setPartialSelection(parsed.pages)
  }

  const activatePartialMode = () => {
    if (mode === 'all') setPartialSelection(pages)
    setMode('partial')
  }

  const activateAllMode = () => {
    setMode('all')
    setRangeError('')
  }

  const complete = () => {
    if (mode === 'all') {
      onComplete(null)
      return
    }
    if (selected.length === 0) {
      setRangeError('한 페이지 이상 선택해 주세요.')
      return
    }
    onComplete(selected)
  }

  const movePage = (direction: -1 | 1) => {
    setCurrentPage((current) => Math.min(pageCount, Math.max(1, current + direction)))
  }

  const preview =
    isImageMaterial && pdfUrl ? (
      <div className="personal-binder-page-preview">
        <img className="personal-binder-image-preview" src={pdfUrl} alt={material.title} />
      </div>
    ) : pdf.status === 'ready' ? (
      <div
        className="personal-binder-page-preview"
        onPointerDown={(event) => {
          if (isMobile && zoom === 1 && event.button === 0) {
            swipeStartRef.current = event.clientX
            event.currentTarget.setPointerCapture(event.pointerId)
          }
        }}
        onPointerUp={(event) => {
          const start = swipeStartRef.current
          swipeStartRef.current = null
          if (start == null || zoom !== 1) return
          const delta = event.clientX - start
          if (Math.abs(delta) < 48) return
          movePage(delta < 0 ? 1 : -1)
        }}
      >
        <div className="personal-binder-page-preview__toolbar">
          <FormButton variant="action" size="sm" onClick={() => movePage(-1)} disabled={currentPage <= 1}>
            이전
          </FormButton>
          <span>{currentPage} / {pageCount}</span>
          <FormButton variant="action" size="sm" onClick={() => movePage(1)} disabled={currentPage >= pageCount}>
            다음
          </FormButton>
          <FormButton
            variant="action"
            size="sm"
            onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
          >
            축소
          </FormButton>
          <FormButton
            variant="action"
            size="sm"
            onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
          >
            확대
          </FormButton>
          <FormButton variant="action" size="sm" onClick={() => setZoom(1)}>폭 맞춤</FormButton>
        </div>
        <BinderPdfPageCanvas document={pdf.document} pageNumber={currentPage} zoom={zoom} />
      </div>
    ) : (
      <div className="personal-binder-pdf-status">
        {pdf.status === 'error' ? pdf.error : 'PDF를 불러오는 중…'}
      </div>
    )

  const thumbnailPanel =
    isImageMaterial && pdfUrl ? (
      <div className="personal-binder-thumbnails" aria-label="페이지 선택">
        <button
          type="button"
          className={`personal-binder-thumbnail${mode === 'all' || selected.includes(1) ? ' is-selected' : ''}`}
          data-binder-page="1"
          onClick={(event) => handlePageClick(1, event)}
        >
          <img src={pdfUrl} alt="" />
          <span>1</span>
        </button>
      </div>
    ) : pdf.status === 'ready' ? (
      <div className="personal-binder-thumbnails" aria-label="페이지 선택">
        {pages.map((page) => (
          <BinderPdfThumbnail
            key={page}
            document={pdf.document}
            pageNumber={page}
            selected={mode === 'all' || selected.includes(page)}
            current={currentPage === page}
            priority={Math.abs(page - currentPage) <= 2}
            onClick={(event) => handlePageClick(page, event)}
          />
        ))}
      </div>
    ) : null

  const shellClass = [
    'personal-binder-page-editor',
    presentation === 'panel' ? 'personal-binder-page-editor--panel' : 'personal-binder-page-editor--modal',
  ].join(' ')

  const fileDisplay = splitBinderFileDisplayName(material)
  const fileLabel = `${fileDisplay.baseName}.${fileDisplay.extension.toLowerCase()}`
  const panelMode = presentation === 'panel' && !isMobile

  const selectionSummary =
    mode === 'all'
      ? `${pageCount}페이지 전체`
      : `선택 ${formatSelectedPages(selected) || '없음'}`

  const panelToolbar = panelMode ? (
    <section className="personal-binder-page-toolbar personal-binder-page-toolbar--panel" aria-label="페이지 선택">
      <FormButton
        size="sm"
        variant={mode === 'all' ? 'primary' : 'secondary'}
        onClick={activateAllMode}
      >
        전체 페이지
      </FormButton>
      <FormButton
        size="sm"
        variant={mode === 'partial' ? 'primary' : 'secondary'}
        onClick={activatePartialMode}
      >
        일부 페이지
      </FormButton>
      {mode === 'partial' ? (
        <>
          <FormInput
            className="personal-binder-page-toolbar__range"
            value={rangeInput}
            onChange={(event) => setRangeInput(event.target.value)}
            placeholder="예: 3-6, 9"
            aria-label="페이지 범위"
          />
          <FormButton size="sm" variant="secondary" onClick={applyRange}>범위 적용</FormButton>
          <FormButton size="sm" variant="action" onClick={() => setPartialSelection(pages)}>전체 선택</FormButton>
          <FormButton size="sm" variant="action" onClick={() => setPartialSelection([])}>전체 해제</FormButton>
        </>
      ) : null}
      <span className="personal-binder-page-toolbar__summary">{selectionSummary}</span>
      <FormButton size="sm" variant="primary" onClick={complete}>적용</FormButton>
    </section>
  ) : null

  return (
    <div ref={rootRef} className={shellClass}>
      <header
        className={[
          'personal-binder-page-dialog__header',
          presentation === 'panel' ? 'personal-binder-page-dialog__header--panel' : '',
          panelMode ? 'personal-binder-studio-pane__header' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="personal-binder-page-dialog__header-copy">
          {panelMode ? (
            <>
              <h2 className="personal-binder-studio-pane__title">미리보기</h2>
              <p className="personal-binder-studio-pane__meta" title={fileLabel}>
                {fileLabel} · 원본 {pageCount}페이지 · 사용 {usedPageCount}페이지
              </p>
            </>
          ) : presentation === 'panel' ? (
            <>
              <h2 className="personal-binder-page-panel-header__title">{material.title}</h2>
              <p className="personal-binder-page-panel-header__meta">
                원본 {pageCount}페이지 · 사용 {usedPageCount}페이지
              </p>
            </>
          ) : (
            <>
              <h2>{material.title}</h2>
              <p>{material.originalFileName} · 원본 {pageCount}페이지</p>
            </>
          )}
        </div>
        {presentation === 'panel' ? (
          <FormButton variant="secondary" size="sm" onClick={() => void requestClose()}>닫기</FormButton>
        ) : null}
      </header>

      {isMobile ? (
        <div className="personal-binder-page-dialog__mobile">
          {preview}
          <div className="personal-binder-page-dialog__mobile-thumbnails">{thumbnailPanel}</div>
        </div>
      ) : presentation === 'panel' ? (
        <div className="personal-binder-page-editor__panel-body">
          {preview}
          <aside className="personal-binder-page-panel">
            <h3 className="personal-binder-page-panel__title">페이지 선택</h3>
            <div className="personal-binder-page-panel__thumbnails">{thumbnailPanel}</div>
          </aside>
        </div>
      ) : (
        <div className="personal-binder-page-dialog__desktop">
          <aside className="personal-binder-page-placement" aria-label="저장 위치">
            <h3 className="personal-binder-page-placement__title">저장 위치</h3>
            <div className="personal-binder-page-placement-tree">
              <p className="personal-binder-page-placement-tree__level personal-binder-page-placement-tree__level--0">
                내 바인더
              </p>
              <p className="personal-binder-page-placement-tree__level personal-binder-page-placement-tree__level--1">
                {folderLabel}
              </p>
              <p className="personal-binder-page-placement-tree__level personal-binder-page-placement-tree__level--2">
                {binder.title}
              </p>
              <p
                className={[
                  'personal-binder-page-placement-tree__level',
                  'personal-binder-page-placement-tree__level--3',
                  'personal-binder-page-placement-tree__level--current',
                ].join(' ')}
              >
                {sectionTitle || '섹션'}
              </p>
              <p
                className={[
                  'personal-binder-page-placement-tree__level',
                  'personal-binder-page-placement-tree__level--4',
                  'personal-binder-page-placement-tree__level--material',
                ].join(' ')}
              >
                {material.title}
              </p>
            </div>
          </aside>
          {preview}
          <aside className="personal-binder-page-panel">
            <h3 className="personal-binder-page-panel__title">페이지 선택</h3>
            <div className="personal-binder-page-panel__thumbnails">{thumbnailPanel}</div>
          </aside>
        </div>
      )}

      {panelToolbar}

      {!panelMode ? (
        <>
          <section className="personal-binder-page-options">
            <div className="personal-binder-segmented">
              <FormButton variant={mode === 'all' ? 'primary' : 'secondary'} onClick={activateAllMode}>
                전체 페이지 사용
              </FormButton>
              <FormButton variant={mode === 'partial' ? 'primary' : 'secondary'} onClick={activatePartialMode}>
                일부 페이지만 사용
              </FormButton>
            </div>
            {mode === 'partial' ? (
              <div className="personal-binder-range-row">
                <FormInput
                  value={rangeInput}
                  onChange={(event) => setRangeInput(event.target.value)}
                  placeholder="예: 3-6, 9, 12-15"
                  aria-label="페이지 범위"
                />
                <FormButton variant="secondary" onClick={applyRange}>범위 적용</FormButton>
                <FormButton variant="action" onClick={() => setPartialSelection(pages)}>전체 선택</FormButton>
                <FormButton variant="action" onClick={() => setPartialSelection([])}>전체 해제</FormButton>
              </div>
            ) : null}
            {rangeError ? <p className="personal-binder-error">{rangeError}</p> : null}
          </section>

          <footer className="personal-binder-page-dialog__footer">
            <span className="personal-binder-page-dialog__footer-summary">{selectionSummary}</span>
            <FormButton variant="primary" onClick={complete}>
              {presentation === 'panel' ? '적용' : '선택 완료'}
            </FormButton>
          </footer>
        </>
      ) : (
        rangeError ? <p className="personal-binder-error personal-binder-page-toolbar__error">{rangeError}</p> : null
      )}
      {confirmDialog}
    </div>
  )
})
