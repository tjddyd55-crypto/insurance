import { useEffect, useRef, type ReactNode } from 'react'
import { FormButton } from '../form'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useNewsDetailViewerPinchZoom } from './useNewsDetailViewerPinchZoom'
import './news-detail-viewer.css'

export type NewsDetailViewerModalProps = {
  open: boolean
  onClose: () => void
  zoom: number
  onZoomChange: (zoom: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  children: ReactNode
  headerActions?: ReactNode
  zoomControlVariant?: 'symbols' | 'labels'
  closeLabel?: string
  loading?: boolean
  error?: string | null
  loadingMessage?: string
  ariaLabel?: string
  panelClassName?: string
}

export default function NewsDetailViewerModal({
  open,
  onClose,
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  children,
  headerActions,
  zoomControlVariant = 'symbols',
  closeLabel = '✕',
  loading = false,
  error = null,
  loadingMessage = '소식지 상세를 불러오는 중입니다…',
  ariaLabel = '소식지 상세',
  panelClassName,
}: NewsDetailViewerModalProps) {
  useBodyScrollLock(open)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinchEnabled = open && !loading && !error

  useNewsDetailViewerPinchZoom(scrollRef, zoom, onZoomChange, pinchEnabled)

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const zoomInLabel = zoomControlVariant === 'labels' ? '확대' : '＋'
  const zoomOutLabel = zoomControlVariant === 'labels' ? '축소' : '－'

  return (
    <div className="news-detail-viewer-backdrop" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div
        className={['news-detail-viewer-panel', panelClassName].filter(Boolean).join(' ')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="news-detail-viewer-header">
          <FormButton
            htmlType="button"
            variant="action"
            className="filter-button customer-news-modal-control"
            onClick={onZoomIn}
          >
            {zoomInLabel}
          </FormButton>
          <FormButton
            htmlType="button"
            variant="action"
            className="filter-button customer-news-modal-control"
            onClick={onZoomOut}
          >
            {zoomOutLabel}
          </FormButton>
          {headerActions}
          <FormButton
            htmlType="button"
            variant="action"
            className="filter-button close-btn customer-news-modal-close"
            onClick={onClose}
          >
            {closeLabel}
          </FormButton>
        </header>

        <div ref={scrollRef} className="news-detail-viewer-scroll">
          {loading ? <div className="news-detail-viewer-status">{loadingMessage}</div> : null}
          {!loading && error ? <div className="news-detail-viewer-status">{error}</div> : null}
          {!loading && !error ? children : null}
        </div>
      </div>
    </div>
  )
}
