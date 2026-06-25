import { FormButton } from '../../../components/form'
import { resolveClaimRequestCustomerId } from '../utils/resolveClaimRequestCustomerId'

export type ClaimRequestAttachmentActionsVariant = 'desktop' | 'mobile' | 'compact'

export type ClaimRequestAttachmentActionsSection = 'all' | 'customerPage' | 'bundle'

export type ClaimRequestAttachmentActionsProps = {
  attachmentCount: number
  customerClaimPageUrl?: string
  customerClaimPageBusy?: boolean
  onOpenCustomerClaimPage?: () => void | Promise<void>
  /** customer-app = 외부 고객앱 링크, crm-internal = CRM 고객 청구관리 */
  customerPageTarget?: 'customer-app' | 'crm-internal'
  customerId?: number | null
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

function resolveLabels(variant: ClaimRequestAttachmentActionsVariant, customerPageTarget: 'customer-app' | 'crm-internal') {
  if (customerPageTarget === 'crm-internal') {
    return {
      customerPage: variant === 'mobile' ? '청구관리 열기' : '고객 청구관리 열기',
      pdf: variant === 'mobile' ? 'PDF 다운로드' : 'PDF로 다운로드',
      zip: variant === 'mobile' ? '전체 다운로드' : '원본 전체 다운로드',
    }
  }
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
  customerPageTarget = 'customer-app',
  customerId = null,
  onDownloadZip,
  onDownloadPdf,
  zipBusy = false,
  pdfBusy = false,
  variant = 'desktop',
  showCustomerClaimPage = true,
  section = 'all',
  className = '',
}: ClaimRequestAttachmentActionsProps) {
  const labels = resolveLabels(variant, customerPageTarget)
  const resolvedCustomerId = resolveClaimRequestCustomerId({ customerId })
  const bundleDisabled = attachmentCount <= 0 || zipBusy || pdfBusy
  const customerPageDisabled =
    customerClaimPageBusy ||
    !onOpenCustomerClaimPage ||
    (customerPageTarget === 'customer-app' && !customerClaimPageUrl.trim()) ||
    (customerPageTarget === 'crm-internal' && resolvedCustomerId == null)

  const customerPageTitle =
    customerPageTarget === 'crm-internal'
      ? customerPageDisabled && !customerClaimPageBusy
        ? '연결된 고객 정보가 없어 청구관리 화면을 열 수 없습니다.'
        : '고객관리 화면의 청구관리 섹션을 엽니다.'
      : customerPageDisabled && !customerClaimPageBusy
        ? '고객앱 연결 링크가 없습니다. 링크를 생성한 뒤 다시 시도해 주세요.'
        : '고객이 청구 파일을 올리는 페이지를 엽니다.'

  const customerPageButton =
    showCustomerClaimPage && onOpenCustomerClaimPage ? (
      <FormButton
        htmlType="button"
        variant="primary"
        size={variant === 'mobile' ? 'md' : 'sm'}
        className={
          variant === 'mobile'
            ? 'claim-requests-page__primary-action claim-request-open-customer-button'
            : 'claim-request-open-customer-button'
        }
        disabled={customerPageDisabled}
        loading={customerClaimPageBusy}
        loadingText={customerPageTarget === 'crm-internal' ? '이동 중…' : '링크 준비 중…'}
        title={customerPageTitle}
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
