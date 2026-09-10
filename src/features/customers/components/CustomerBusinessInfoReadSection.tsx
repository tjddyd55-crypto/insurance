import type { CustomerBusinessInfo } from '../domain/customerBusinessInfo'
import { formatBusinessNumberDisplay } from '../domain/customerBusinessInfo'

export type CustomerBusinessInfoReadSectionProps = {
  businessInfo: CustomerBusinessInfo | null | undefined
}

function ReadRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null
  }
  return (
    <p className="customer-detail-read__info-line">
      <span className="customer-detail-read__info-label">{label}:</span>{' '}
      <span className="customer-detail-read__info-value">{value}</span>
    </p>
  )
}

export function CustomerBusinessInfoReadSection({ businessInfo }: CustomerBusinessInfoReadSectionProps) {
  if (!businessInfo) {
    return (
      <section className="customer-detail-read__section" aria-labelledby="customer-business-info-heading">
        <div className="customer-detail-read__section-header">
          <h4 id="customer-business-info-heading" className="customer-detail-read__section-title">
            사업자 정보
          </h4>
        </div>
        <div className="customer-detail-read__section-body">내용 없음</div>
      </section>
    )
  }

  const hasAny =
    businessInfo.representativeName.trim() ||
    businessInfo.businessNumber.trim() ||
    businessInfo.businessAddress.trim() ||
    businessInfo.memo.trim()

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-business-info-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-business-info-heading" className="customer-detail-read__section-title">
          사업자 정보
        </h4>
      </div>
      <div className="customer-detail-read__section-body">
        {hasAny ? (
          <>
            <ReadRow label="대표자명" value={businessInfo.representativeName} />
            <ReadRow
              label="사업자번호"
              value={formatBusinessNumberDisplay(businessInfo.businessNumber)}
            />
            <ReadRow label="사업장 주소" value={businessInfo.businessAddress} />
            {businessInfo.memo.trim() ? (
              <div className="customer-detail-read__memo-block">{businessInfo.memo}</div>
            ) : null}
          </>
        ) : (
          '내용 없음'
        )}
      </div>
    </section>
  )
}
