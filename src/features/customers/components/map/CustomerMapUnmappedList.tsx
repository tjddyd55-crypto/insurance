import { FormButton } from '../../../../components/form'
import type { CustomerMapUnmappedItem } from '../../api/customerMapApi'
import { formatCustomerPhoneUi } from '../../utils/customerDisplayFormat'

type CustomerMapUnmappedListProps = {
  customers: CustomerMapUnmappedItem[]
  onOpenDetail: (customerId: number) => void
}

function formatBirthDateYmd(value: string): string {
  const trimmed = value.trim()
  return trimmed || '-'
}

export default function CustomerMapUnmappedList({
  customers,
  onOpenDetail,
}: CustomerMapUnmappedListProps) {
  if (customers.length === 0) {
    return (
      <p className="customer-map-unmapped-list__empty" role="status">
        지도에 표시되지 않는 고객이 없습니다.
      </p>
    )
  }

  return (
    <section className="customer-map-unmapped-list" aria-label="지도 미표시 고객 목록">
      <ul className="customer-map-unmapped-list__items">
        {customers.map((customer) => (
          <li key={customer.id} className="customer-map-unmapped-list__item">
            <div className="customer-map-unmapped-list__head">
              <h3 className="customer-map-unmapped-list__name">{customer.name || '이름 없음'}</h3>
              <span className="customer-map-unmapped-list__status">{customer.mapStatusLabel}</span>
            </div>
            <p className="customer-map-unmapped-list__meta">
              {customer.genderLabel || '-'} · {formatBirthDateYmd(customer.birthDateYmd)} ·{' '}
              {formatCustomerPhoneUi(customer.phone) || '연락처 없음'}
            </p>
            <p className="customer-map-unmapped-list__address">
              {customer.address.trim() || '주소 없음'}
            </p>
            <FormButton
              htmlType="button"
              variant="secondary"
              className="customer-map-unmapped-list__detail-btn"
              onClick={() => onOpenDetail(customer.id)}
            >
              상세 이동
            </FormButton>
          </li>
        ))}
      </ul>
    </section>
  )
}
