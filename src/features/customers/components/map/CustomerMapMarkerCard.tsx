import { FormButton } from '../../../../components/form'
import type { CustomerMapListItem } from '../../api/customerMapApi'

type CustomerMapMarkerCardProps = {
  customer: CustomerMapListItem
  onClose: () => void
  onOpenDetail: (customerId: number) => void
}

function formatPhone(phone: string): string {
  const trimmed = phone.trim()
  return trimmed || '연락처 없음'
}

function formatLastConsult(date: string | null): string {
  if (!date?.trim()) {
    return '상담 이력 없음'
  }
  return date.trim()
}

export default function CustomerMapMarkerCard({
  customer,
  onClose,
  onOpenDetail,
}: CustomerMapMarkerCardProps) {
  return (
    <aside className="customer-map-marker-card" aria-label="고객 요약">
      <div className="customer-map-marker-card__header">
        <div className="customer-map-marker-card__title-row">
          <span className="customer-map-marker-card__marker-no">{customer.markerNo}</span>
          <h2 className="customer-map-marker-card__name">{customer.name || '이름 없음'}</h2>
        </div>
        <button type="button" className="customer-map-marker-card__close" onClick={onClose}>
          닫기
        </button>
      </div>
      <dl className="customer-map-marker-card__fields">
        <div>
          <dt>연락처</dt>
          <dd>{formatPhone(customer.phone)}</dd>
        </div>
        <div>
          <dt>주소</dt>
          <dd>{customer.address.trim() || '-'}</dd>
        </div>
        <div>
          <dt>최근 상담</dt>
          <dd>{formatLastConsult(customer.lastConsultDate)}</dd>
        </div>
      </dl>
      <FormButton
        htmlType="button"
        variant="primary"
        className="customer-map-marker-card__detail-btn"
        onClick={() => onOpenDetail(customer.id)}
      >
        상세 이동
      </FormButton>
    </aside>
  )
}
