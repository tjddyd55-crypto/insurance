import { FormButton } from '../../../../components/form'
import type { CustomerMapListItem } from '../../api/customerMapApi'

type CustomerMapCustomerListProps = {
  customers: CustomerMapListItem[]
  selectedCustomerId: number | null
  onOpenDetail: (customerId: number) => void
  onSelectCustomer: (customerId: number | null) => void
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

export default function CustomerMapCustomerList({
  customers,
  selectedCustomerId,
  onOpenDetail,
  onSelectCustomer,
}: CustomerMapCustomerListProps) {
  if (customers.length === 0) {
    return null
  }

  return (
    <section className="customer-map-customer-list" aria-label="지도 표시 고객 목록">
      {customers.map((customer) => {
        const selected = customer.id === selectedCustomerId
        return (
          <article
            key={customer.id}
            className={`customer-map-customer-card${selected ? ' customer-map-customer-card--selected' : ''}`}
            onClick={() => onSelectCustomer(customer.id)}
          >
            <div className="customer-map-customer-card__head">
              <span className="customer-map-customer-card__marker-no">{customer.markerNo}</span>
              <h2 className="customer-map-customer-card__name">{customer.name || '이름 없음'}</h2>
            </div>
            <dl className="customer-map-customer-card__fields">
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
              className="customer-map-customer-card__detail-btn"
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetail(customer.id)
              }}
            >
              상세 이동
            </FormButton>
          </article>
        )
      })}
    </section>
  )
}
