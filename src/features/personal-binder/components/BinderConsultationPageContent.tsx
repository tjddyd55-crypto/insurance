import NewsDetailZoomContent from '../../../components/news-detail-viewer/NewsDetailZoomContent'
import FormButton from '../../../components/form/FormButton'
import type { BinderPdfViewerFitMode } from '../domain/binderPdfViewerScale'
import { BinderPdfPageCanvas } from './BinderPdfCanvas'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const VIEWER_PADDING = 16

type BinderConsultationPageContentProps = {
  kind: 'pdf' | 'image'
  document?: PDFDocumentProxy
  pageNumber?: number
  imageUrl?: string
  imageAlt?: string
  fit: BinderPdfViewerFitMode
  zoom: number
  containerWidth: number
  containerHeight: number
  className?: string
  onRenderError?: () => void
}

export function BinderConsultationPageContent({
  kind,
  document,
  pageNumber = 1,
  imageUrl,
  imageAlt = '',
  fit,
  zoom,
  containerWidth,
  containerHeight,
  className = '',
  onRenderError,
}: BinderConsultationPageContentProps) {
  if (kind === 'pdf' && document) {
    return (
      <BinderPdfPageCanvas
        document={document}
        pageNumber={pageNumber}
        fit={fit}
        zoom={zoom}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        className={className}
        onError={onRenderError}
      />
    )
  }

  if (kind === 'image' && imageUrl) {
    const layoutWidth = Math.max(0, containerWidth - VIEWER_PADDING * 2)
    return (
      <NewsDetailZoomContent zoom={zoom} className={['personal-binder-viewer__image-wrap', className].join(' ')}>
        <img
          className="personal-binder-viewer__image"
          src={imageUrl}
          alt={imageAlt}
          style={
            layoutWidth > 0 && fit === 'width' && zoom <= 1
              ? { maxWidth: layoutWidth }
              : undefined
          }
          onError={() => onRenderError?.()}
        />
      </NewsDetailZoomContent>
    )
  }

  return null
}

type BinderConsultationPageErrorProps = {
  message: string
  materialTitle?: string
  onRetry: () => void
}

export function BinderConsultationPageError({
  message,
  materialTitle,
  onRetry,
}: BinderConsultationPageErrorProps) {
  return (
    <div className="personal-binder-viewer__page-error" role="alert">
      <p>{message}</p>
      {materialTitle ? <span className="personal-binder-viewer__page-error-meta">{materialTitle}</span> : null}
      <FormButton variant="secondary" size="sm" onClick={onRetry}>
        다시 시도
      </FormButton>
    </div>
  )
}
