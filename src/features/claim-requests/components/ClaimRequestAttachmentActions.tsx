import { FormButton } from '../../../components/form'

export type ClaimRequestAttachmentActionsVariant = 'desktop' | 'mobile' | 'compact'

export type ClaimRequestAttachmentActionsSection = 'all' | 'customerPage' | 'bundle'

export type ClaimRequestAttachmentActionsProps = {
  attachmentCount: number
  customerClaimPageUrl?: string
  customerClaimPageBusy?: boolean
  onOpenCustomerClaimPage?: () => void | Promise<void>
  onDownloadZip: () => void | Promise<void>
  onDownloadPdf: () => void | Promise<void>
  zipBusy?: boolean
  pdfBusy?: boolean
  variant?: ClaimRequestAttachmentActionsVariant
  showCustomerClaimPage?: boolean
  /** customerPage = 상단 버튼만, bundle = PDF/ZIP만, all = 둘 다(세로 배치) */
  section?: ClaimRequestAttachmentActionsSection
  className?: string
}

function resolveLabels(variant: ClaimRequestAttachmentActionsVariant) {
  if (variant === 'mobile') {
    return {
      customerPage: '청구페이지 열기',
      pdf: 'PDF 다운로드',
      zip: '전체 다운로드',
    }
  }
  return {
    customerPage: '고객 청구페이지 열기',
    pdf: 'PDF로 다운로드',
    zip: '원본 전체 다운로드',
  }
}

export default function ClaimRequestAttachmentActions({
  attachmentCount,
  customerClaimPageUrl = '',
  customerClaimPageBusy = false,
  onOpenCustomerClaimPage,
  onDownloadZip,
  onDownloadPdf,
  zipBusy = false,
  pdfBusy = false,
  variant = 'desktop',
  showCustomerClaimPage = true,
  section = 'all',
  className = '',
}: ClaimRequestAttachmentActionsProps) {
  const labels = resolveLabels(variant)
  const bundleDisabled = attachmentCount <= 0 || zipBusy || pdfBusy
  const customerPageDisabled =
    customerClaimPageBusy || !customerClaimPageUrl.trim() || !onOpenCustomerClaimPage

  const customerPageButton =
    showCustomerClaimPage && onOpenCustomerClaimPage ? (
      <FormButton
        htmlType="button"
        variant="primary"
        size={variant === 'mobile' ? 'md' : 'sm'}
        className={variant === 'mobile' ? 'claim-requests-page__primary-action' : undefined}
        disabled={customerPageDisabled}
        loading={customerClaimPageBusy}
        loadingText="링크 준비 중…"
        title={
          customerPageDisabled && !customerClaimPageBusy
            ? '고객앱 연결 링크가 없습니다. 링크를 생성한 뒤 다시 시도해 주세요.'
            : '고객이 청구 파일을 올리는 페이지를 엽니다.'
        }
        onClick={() => void onOpenCustomerClaimPage()}
      >
        {labels.customerPage}
      </FormButton>
    ) : null

  const bundleActions = (
    <div className="claim-requests-page__attachment-bundle-actions">
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        disabled={bundleDisabled}
        loading={pdfBusy}
        loadingText="PDF 생성 중…"
        title="이미지/PDF 첨부를 하나의 PDF로 묶어 다운로드합니다."
        onClick={() => void onDownloadPdf()}
      >
        {labels.pdf}
      </FormButton>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        disabled={bundleDisabled}
        loading={zipBusy}
        loadingText="ZIP 생성 중…"
        title="첨부 원본 파일을 ZIP으로 다운로드합니다."
        onClick={() => void onDownloadZip()}
      >
        {labels.zip}
      </FormButton>
    </div>
  )

  if (section === 'customerPage') {
    if (!customerPageButton) {
      return null
    }
    return (
      <div className={`claim-requests-page__attachment-actions claim-requests-page__attachment-actions--customer${className ? ` ${className}` : ''}`}>
        {customerPageButton}
      </div>
    )
  }

  if (section === 'bundle') {
    return bundleActions
  }

  return (
    <div className={`claim-requests-page__attachment-actions${className ? ` ${className}` : ''}`}>
      {customerPageButton}
      {customerPageButton ? (
        <div className="claim-requests-page__attachment-actions-row claim-requests-page__attachment-actions-row--bundle">
          {bundleActions}
        </div>
      ) : (
        bundleActions
      )}
    </div>
  )
}
