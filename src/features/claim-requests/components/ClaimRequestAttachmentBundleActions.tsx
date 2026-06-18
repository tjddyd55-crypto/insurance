import { FormButton } from '../../../components/form'

type ClaimRequestAttachmentBundleActionsProps = {
  fileCount: number
  zipBusy?: boolean
  pdfBusy?: boolean
  onDownloadZip: () => void | Promise<void>
  onDownloadPdf: () => void | Promise<void>
}

export default function ClaimRequestAttachmentBundleActions({
  fileCount,
  zipBusy = false,
  pdfBusy = false,
  onDownloadZip,
  onDownloadPdf,
}: ClaimRequestAttachmentBundleActionsProps) {
  const disabled = fileCount <= 0 || zipBusy || pdfBusy

  return (
    <div className="claim-requests-page__attachment-bundle-actions">
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        loading={pdfBusy}
        loadingText="PDF 생성 중…"
        title="이미지/PDF 첨부를 하나의 PDF로 묶어 다운로드합니다."
        onClick={() => void onDownloadPdf()}
      >
        PDF로 다운로드
      </FormButton>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        loading={zipBusy}
        loadingText="ZIP 생성 중…"
        title="첨부 원본 파일을 ZIP으로 다운로드합니다."
        onClick={() => void onDownloadZip()}
      >
        원본 전체 다운로드
      </FormButton>
    </div>
  )
}
