/**
 * 사용자 PDF 신청 페이지 — 데스크톱: 좌측 폼 + 우측 PDF 오버레이 미리보기.
 */
import { Link } from 'react-router-dom'
import { PdfApplicantPreviewStack } from '../../components/PdfApplicantPreviewStack'
import { PdfApplicantFormPanel } from '../../components/PdfApplicantFormPanel'
import type { PdfDocumentApplicantViewProps } from './pdfDocumentApplicantViewProps'

export default function PdfDocumentApplicantPCView(props: PdfDocumentApplicantViewProps) {
  const {
    template,
    fields,
    pdfBuffer,
    values,
    fontOverrides,
    focusedFieldKey,
    prefillBanner,
    submitting,
    onChangeValues,
    onChangeFontOverrides,
    onFocusedFieldChange,
    onSubmitApplicant,
  } = props

  return (
    <main className="insurance-dark-forms pdf-engine-page pdf-document-detail-page pdf-document-detail-page--pc page--with-back">
      <div className="pdf-engine-page__toolbar">
        <Link to="/application/documents" className="pdf-engine-editor__btn">
          ← 문서 목록
        </Link>
      </div>
      {prefillBanner}
      <div className="pdf-document-detail-page__split">
        <section className="pdf-document-detail-page__form-col" aria-label="신청서 입력">
          <PdfApplicantFormPanel
            title={template.title}
            description={template.description}
            fields={fields}
            values={values}
            fontOverrides={fontOverrides}
            submitting={submitting}
            focusedFieldKey={focusedFieldKey}
            onChangeValues={onChangeValues}
            onChangeFontOverrides={onChangeFontOverrides}
            onFocusedFieldChange={onFocusedFieldChange}
            onSubmit={onSubmitApplicant}
            submitLabel="결과보기"
          />
        </section>
        <section className="pdf-document-detail-page__preview-col" aria-label="PDF 미리보기">
          <h3 className="pdf-document-detail-page__preview-title">미리보기</h3>
          <div className="pdf-document-detail-page__preview-scroll">
            <PdfApplicantPreviewStack
              pdfBuffer={pdfBuffer}
              fields={fields}
              values={values}
              fontSizeOverrides={fontOverrides}
              highlightedFieldKey={focusedFieldKey}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
