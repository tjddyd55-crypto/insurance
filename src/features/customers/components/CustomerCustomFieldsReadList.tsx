import type { CustomerCustomFieldRecord } from '../api/customerCustomFieldsApi'

export type CustomerCustomFieldsReadListProps = {
  items: CustomerCustomFieldRecord[]
  loading?: boolean
}

export function CustomerCustomFieldsReadList({ items, loading }: CustomerCustomFieldsReadListProps) {
  if (loading) {
    return <p className="customer-custom-fields-read__loading">추가 정보 불러오는 중…</p>
  }
  if (!items.length) {
    return <p className="customer-custom-fields-read__empty">등록된 추가 정보가 없습니다.</p>
  }
  return (
    <dl className="customer-custom-fields-read__list">
      {items.map((item) => (
        <div key={item.id} className="customer-custom-fields-read__item">
          <dt className="customer-custom-fields-read__label">{item.label}</dt>
          <dd className="customer-custom-fields-read__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
