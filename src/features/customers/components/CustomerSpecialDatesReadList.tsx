import { CUSTOMER_DESIGNATED_DATE_LABEL } from '../../../../shared/customerDesignatedDateCopy.js'
import { labelForCustomerSpecialDatePurpose } from '../config/customerSpecialDatePurpose.config'
import type { CustomerSpecialDateRecord } from '../api/customerSpecialDatesApi'

export type CustomerSpecialDatesReadListProps = {
  items: CustomerSpecialDateRecord[]
  loading?: boolean
}

export function CustomerSpecialDatesReadList({ items, loading }: CustomerSpecialDatesReadListProps) {
  if (loading) {
    return <p className="customer-special-dates-read__loading">{CUSTOMER_DESIGNATED_DATE_LABEL}을 불러오는 중…</p>
  }
  if (!items.length) {
    return <p className="customer-special-dates-read__empty">등록된 {CUSTOMER_DESIGNATED_DATE_LABEL}이 없습니다.</p>
  }
  return (
    <ul className="customer-special-dates-read__list">
      {items.map((item) => (
        <li key={item.id} className="customer-special-dates-read__item">
          <span className="customer-special-dates-read__purpose">
            {labelForCustomerSpecialDatePurpose(item.purposeType)}
          </span>
          <span className="customer-special-dates-read__sep" aria-hidden="true">
            ·
          </span>
          <span className="customer-special-dates-read__title">{item.title}</span>
          <span className="customer-special-dates-read__sep" aria-hidden="true">
            ·
          </span>
          <span className="customer-special-dates-read__date">{item.dateValue}</span>
          {item.memo?.trim() ? (
            <span className="customer-special-dates-read__memo"> ({item.memo.trim()})</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
