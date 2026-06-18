import { FormButton } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import {
  PDF_DOCUMENT_PREVIEW_ACTION_LABELS,
  PDF_DOCUMENT_PREVIEW_SUBTITLE,
} from '../config/pdfDocumentPreviewModalUi'

export type PdfDocumentResultPreviewModalProps = {
  open: boolean
  saving: boolean
  canDownload: boolean
  resultPdfFilename: string
  previewUrl: string | null
  previewError: string | null
  onClose: () => void
  onDownload: () => void
}

/**
 * 신청서·계약서 등 모든 PDF 템플릿의 결과 미리보기 모달.
 * 문서 타입별 분기 없이 동일 footer(수정하기 / 다운로드 / 닫기)를 사용한다.
 */
export default function PdfDocumentResultPreviewModal({
  open,
  saving,
  canDownload,
  resultPdfFilename,
  previewUrl,
  previewError,
  onClose,
  onDownload,
}: PdfDocumentResultPreviewModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return
        onClose()
      }}
      closeOnBackdrop={false}
      closeOnEsc={false}
      ariaLabel={`PDF 결과 미리보기 · ${resultPdfFilename}`}
      panelClassName="pdf-engine-preview-modal"
    >
      <div className="pdf-engine-preview">
        <header className="pdf-engine-preview__header">
          <h3>결과 미리보기</h3>
          <div
            className="pdf-engine-preview__filename-chip"
            title={resultPdfFilename}
            aria-label={`발급 PDF 파일명 ${resultPdfFilename}`}
          >
            {resultPdfFilename}
          </div>
          <p className="pdf-engine-preview__subtitle">{PDF_DOCUMENT_PREVIEW_SUBTITLE}</p>
        </header>
        {previewError ? <div className="pdf-engine-page__error">{previewError}</div> : null}
        <div className="pdf-engine-preview__frame-wrap">
          {previewUrl ? (
            <iframe title={resultPdfFilename} src={previewUrl} className="pdf-engine-preview__frame" />
          ) : (
            <p className="pdf-engine-page__hint">미리보기 파일을 준비하지 못했습니다.</p>
          )}
        </div>
        <div className="pdf-engine-preview__actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="pdf-engine-editor__btn"
            onClick={onClose}
            disabled={saving}
          >
            {PDF_DOCUMENT_PREVIEW_ACTION_LABELS.edit}
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
            onClick={onDownload}
            disabled={saving || !canDownload}
          >
            {saving
              ? PDF_DOCUMENT_PREVIEW_ACTION_LABELS.downloadBusy
              : PDF_DOCUMENT_PREVIEW_ACTION_LABELS.download}
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="pdf-engine-editor__btn"
            onClick={onClose}
            disabled={saving}
          >
            {PDF_DOCUMENT_PREVIEW_ACTION_LABELS.close}
          </FormButton>
        </div>
      </div>
    </Modal>
  )
}
