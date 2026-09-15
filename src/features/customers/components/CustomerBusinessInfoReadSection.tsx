import type { CustomerBusinessInfo } from '../domain/customerBusinessInfo'
import {
  formatBusinessNumberDisplay,
  isCustomerBusinessInfoFormEmpty,
  customerBusinessInfoToForm,
} from '../domain/customerBusinessInfo'

export type CustomerBusinessInfoReadSectionProps = {
  businessInfo: CustomerBusinessInfo | null | undefined
}

function ReadRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null
  return (
    <p className="customer-detail-read__info-line">
      <span className="customer-detail-read__info-label">{label}:</span>{' '}
      <span className="customer-detail-read__info-value">{value}</span>
    </p>
  )
}

export function CustomerBusinessInfoReadSection({
  businessInfo,
}: CustomerBusinessInfoReadSectionProps) {
  const form = customerBusinessInfoToForm(businessInfo ?? null)
  if (isCustomerBusinessInfoFormEmpty(form)) {
    return null
  }

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-business-info-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-business-info-heading" className="customer-detail-read__section-title">
          사업자 정보
        </h4>
      </div>
      <div className="customer-detail-read__section-body">
        <ReadRow label="대표자명" value={form.representativeName} />
        <ReadRow label="사업자번호" value={formatBusinessNumberDisplay(form.businessNumber)} />
        <ReadRow label="주소" value={form.address} />
        {form.memo.trim() ? (
          <div className="customer-detail-read__memo-block">{form.memo}</div>
        ) : null}
      </div>
    </section>
  )
}
