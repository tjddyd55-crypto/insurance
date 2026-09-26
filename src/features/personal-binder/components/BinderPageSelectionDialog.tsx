import { useEffect, useRef, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
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
import type {
  PersonalBinder,
  PersonalBinderMaterial,
} from '../personalBinder.types'
import { BinderPdfPageCanvas, BinderPdfThumbnail } from './BinderPdfCanvas'

type Props = {
  open: boolean
  variant: 'desktop' | 'mobile'
  binder: PersonalBinder
  material: PersonalBinderMaterial | null
  pdfUrl: string | null
  initialSelection: number[] | null
  onClose: () => void
  onComplete: (selection: number[] | null) => void
}

export function BinderPageSelectionDialog({
  open,
  variant,
  binder,
  material,
  pdfUrl,
  initialSelection,
  onClose,
  onComplete,
}: Props) {
  const isMobile = variant === 'mobile'
  const { confirm, confirmDialog } = useConfirmDialog()
  const pdf = useBinderPdfDocument(open ? pdfUrl : null)
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
    if (!open || !material) return
    const frame = requestAnimationFrame(() => {
      const next = initialSelection == null
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
  }, [initialSelection, material, open])

  useEffect(() => {
    if (!open) return
    document
      .querySelector(`.personal-binder-page-dialog [data-binder-page="${currentPage}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [currentPage, open])

  if (!open || !material) return null

  const pageCount = material.pageCount
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
  const setPartialSelection = (next: number[]) => {
    const normalized = normalizeSelectedPages(next, pageCount)
    setSelected(normalized)
    setRangeInput(formatSelectedPages(normalized))
    setRangeError('')
  }
  const handlePageClick = (
    page: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    setCurrentPage(page)
    if (mode !== 'partial') return
    const additive = isMobile || event.metaKey || event.ctrlKey
    const next = togglePageSelection(selected, page, {
      additive,
      shiftFrom: !isMobile && event.shiftKey ? lastSelectedRef.current : null,
    })
    if (!event.shiftKey) lastSelectedRef.current = page
    setPartialSelection(next)
  }
  const requestClose = async () => {
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
      if (!accepted) return
    }
    onClose()
  }
  const applyRange = () => {
    const parsed = parsePageRangeInput(rangeInput, pageCount)
    if (!parsed.ok) {
      setRangeError(parsed.error)
      return
    }
    setPartialSelection(parsed.pages)
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
    setCurrentPage((current) =>
      Math.min(pageCount, Math.max(1, current + direction)),
    )
  }

  const preview = pdf.status === 'ready' ? (
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
        <FormButton variant="action" size="sm" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}>
          축소
        </FormButton>
        <FormButton variant="action" size="sm" onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}>
          확대
        </FormButton>
        <FormButton variant="action" size="sm" onClick={() => setZoom(1)}>
          폭 맞춤
        </FormButton>
      </div>
      <BinderPdfPageCanvas
        document={pdf.document}
        pageNumber={currentPage}
        zoom={zoom}
      />
    </div>
  ) : (
    <div className="personal-binder-pdf-status">
      {pdf.status === 'error' ? pdf.error : 'PDF를 불러오는 중…'}
    </div>
  )

  const thumbnailPanel = pdf.status === 'ready' ? (
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

  return (
    <BaseDialog
      open={open}
      onClose={() => void requestClose()}
      closeOnBackdrop={false}
      closeOnEsc={false}
      usePortal
      panelPreset="largeForm"
      panelClassName="personal-binder-page-dialog"
      overlayClassName="personal-binder-page-dialog-overlay"
      ariaLabel="PDF 페이지 선택"
    >
      <header className="personal-binder-page-dialog__header">
        <div>
          <h2>{material.title}</h2>
          <p>{material.originalFileName} · {pageCount}페이지</p>
        </div>
        <FormButton variant="action" onClick={() => void requestClose()}>닫기</FormButton>
      </header>

      {isMobile ? (
        <div className="personal-binder-page-dialog__mobile">
          {preview}
          <div className="personal-binder-page-dialog__mobile-thumbnails">
            {thumbnailPanel}
          </div>
        </div>
      ) : (
        <div className="personal-binder-page-dialog__desktop">
          <aside className="personal-binder-tree">
            <h3>{binder.title}</h3>
            {binder.sections.map((section) => (
              <div key={section.id}>
                <strong>{section.title}</strong>
                {section.items.map((item) => (
                  <span key={item.id}>
                    {item.material.title}
                    {item.pageSelection ? ` · ${formatSelectedPages(item.pageSelection)}p` : ' · 전체'}
                  </span>
                ))}
              </div>
            ))}
          </aside>
          {preview}
          <aside className="personal-binder-page-panel">
            <h3>페이지 선택</h3>
            {thumbnailPanel}
          </aside>
        </div>
      )}

      <section className="personal-binder-page-options">
        <div className="personal-binder-segmented">
          <FormButton
            variant={mode === 'all' ? 'primary' : 'secondary'}
            onClick={() => setMode('all')}
          >
            전체 페이지 사용
          </FormButton>
          <FormButton
            variant={mode === 'partial' ? 'primary' : 'secondary'}
            onClick={() => setMode('partial')}
          >
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
        <span>
          {mode === 'all'
            ? `${pageCount}페이지 전체`
            : selected.length <= 6
              ? `선택: ${selected.join(', ') || '없음'}`
              : `${selected.length}페이지 선택`}
        </span>
        <FormButton variant="primary" onClick={complete}>선택 완료</FormButton>
      </footer>
      {confirmDialog}
    </BaseDialog>
  )
}
