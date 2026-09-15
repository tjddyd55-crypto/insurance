import type { CustomerSpecialDateRecord } from '../api/customerSpecialDatesApi'
import { formatCustomerAlertDateLabel } from '../domain/customerAlertDateDisplay'

export type CustomerSpecialDatesReadListProps = {
  items: CustomerSpecialDateRecord[]
  loading?: boolean
  onEdit?: (item: CustomerSpecialDateRecord) => void
}

export function CustomerSpecialDatesReadList({
  items,
  loading,
  onEdit,
}: CustomerSpecialDatesReadListProps) {
  if (loading) {
    return <p className="customer-special-dates-read__loading">알림일을 불러오는 중…</p>
  }
  if (!items.length) {
    return <p className="customer-special-dates-read__empty">등록된 알림일이 없습니다.</p>
  }
  return (
    <ul className="customer-special-dates-read__list">
      {items.map((item) => (
        <li key={item.id} className="customer-special-dates-read__item customer-section-read-row">
          <div className="customer-section-read-row__main">
            <span className="customer-special-dates-read__title">
              {formatCustomerAlertDateLabel(item)}
            </span>
            <span className="customer-special-dates-read__date">{item.dateValue}</span>
          </div>
          {onEdit ? (
            <button type="button" className="customer-section-read-row__edit" onClick={() => onEdit(item)}>
              수정
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
