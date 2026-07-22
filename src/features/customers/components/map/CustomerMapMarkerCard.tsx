import { useEffect, useRef } from 'react'
import { FormButton } from '../../../../components/form'
import type { CustomerMapListItem } from '../../api/customerMapApi'
import { formatCustomerPhoneUi } from '../../utils/customerDisplayFormat'
import type { CustomerMapMarkerGroup } from '../../utils/customerMapMarkerGroups'

type CustomerMapMarkerCardProps = {
  group: CustomerMapMarkerGroup
  highlightedCustomerId: number | null
  onClose: () => void
  onOpenDetail: (customerId: number) => void
  onHighlightCustomer: (customerId: number) => void
}

function formatBirthDateYmd(value: string): string {
  const trimmed = value.trim()
  return trimmed || '-'
}

function formatLastConsult(date: string | null): string {
  if (!date?.trim()) {
    return '상담 이력 없음'
  }
  return date.trim()
}

function CustomerMapMarkerRow({
  customer,
  highlighted,
  onOpenDetail,
  onHighlightCustomer,
}: {
  customer: CustomerMapListItem
  highlighted: boolean
  onOpenDetail: (customerId: number) => void
  onHighlightCustomer: (customerId: number) => void
}) {
  const rowRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (highlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  const phoneLabel = formatCustomerPhoneUi(customer.phone) || '연락처 없음'
  const consultLabel = formatLastConsult(customer.lastConsultDate)

  return (
    <article
      ref={rowRef}
      className={`customer-map-marker-card__row${highlighted ? ' customer-map-marker-card__row--highlighted' : ''}`}
      onClick={() => onHighlightCustomer(customer.id)}
    >
      <div className="customer-map-marker-card__row-main">
        <div className="customer-map-marker-card__row-head">
          <h3 className="customer-map-marker-card__row-name">{customer.name || '이름 없음'}</h3>
          <span className="customer-map-marker-card__row-meta">
            {customer.genderLabel || '-'} · {formatBirthDateYmd(customer.birthDateYmd)}
          </span>
        </div>
        <p className="customer-map-marker-card__row-compact-meta">
          {phoneLabel} · {consultLabel}
        </p>
        <dl className="customer-map-marker-card__row-fields">
          <div>
            <dt>연락처</dt>
            <dd>{phoneLabel}</dd>
          </div>
          <div>
            <dt>최근 상담</dt>
            <dd>{consultLabel}</dd>
          </div>
        </dl>
      </div>
      <FormButton
        htmlType="button"
        variant="primary"
        className="customer-map-marker-card__detail-btn"
        onClick={(event) => {
          event.stopPropagation()
          onOpenDetail(customer.id)
        }}
      >
        상세 이동
      </FormButton>
    </article>
  )
}

export default function CustomerMapMarkerCard({
  group,
  highlightedCustomerId,
  onClose,
  onOpenDetail,
  onHighlightCustomer,
}: CustomerMapMarkerCardProps) {
  const isGroup = group.count > 1
  const highlightedCustomer =
    group.customers.find((customer) => customer.id === highlightedCustomerId) ?? group.customers[0]

  if (!isGroup && highlightedCustomer) {
    const phoneLabel = formatCustomerPhoneUi(highlightedCustomer.phone) || '연락처 없음'
    const consultLabel = formatLastConsult(highlightedCustomer.lastConsultDate)
    const genderBirth = `${highlightedCustomer.genderLabel || '-'} · ${formatBirthDateYmd(highlightedCustomer.birthDateYmd)}`

    return (
      <aside className="customer-map-marker-card" aria-label="고객 요약">
        <div className="customer-map-marker-card__header">
          <div className="customer-map-marker-card__title-row">
            <span className="customer-map-marker-card__marker-no">{highlightedCustomer.markerNo}</span>
            <h2 className="customer-map-marker-card__name">
              {highlightedCustomer.name || '이름 없음'}
            </h2>
          </div>
          <button
            type="button"
            className="customer-map-marker-card__close"
            aria-label="고객 목록 닫기"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <p className="customer-map-marker-card__compact-meta customer-map-marker-card__compact-meta--single">
          {genderBirth}
          <br />
          {phoneLabel} · {consultLabel}
        </p>
        <p className="customer-map-marker-card__address customer-map-marker-card__address--single-compact">
          {highlightedCustomer.address.trim() || '-'}
        </p>
        <dl className="customer-map-marker-card__fields">
          <div>
            <dt>성별</dt>
            <dd>{highlightedCustomer.genderLabel || '-'}</dd>
          </div>
          <div>
            <dt>생년월일</dt>
            <dd>{formatBirthDateYmd(highlightedCustomer.birthDateYmd)}</dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd>{phoneLabel}</dd>
          </div>
          <div>
            <dt>주소</dt>
            <dd>{highlightedCustomer.address.trim() || '-'}</dd>
          </div>
          <div>
            <dt>최근 상담</dt>
            <dd>{consultLabel}</dd>
          </div>
        </dl>
        <FormButton
          htmlType="button"
          variant="primary"
          className="customer-map-marker-card__detail-btn"
          onClick={() => onOpenDetail(highlightedCustomer.id)}
        >
          상세 이동
        </FormButton>
      </aside>
    )
  }

  return (
    <aside className="customer-map-marker-card customer-map-marker-card--group" aria-label="같은 위치 고객 목록">
      <div className="customer-map-marker-card__header">
        <div className="customer-map-marker-card__title-row customer-map-marker-card__title-row--stacked">
          <h2 className="customer-map-marker-card__name">이 위치 고객 {group.count}명</h2>
          <p className="customer-map-marker-card__address">
            {group.address.trim() || '주소 없음'}
          </p>
        </div>
        <button
          type="button"
          className="customer-map-marker-card__close"
          aria-label="고객 목록 닫기"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
      <div className="customer-map-marker-card__group-list">
        {group.customers.map((customer) => (
          <CustomerMapMarkerRow
            key={customer.id}
            customer={customer}
            highlighted={customer.id === highlightedCustomerId}
            onOpenDetail={onOpenDetail}
            onHighlightCustomer={onHighlightCustomer}
          />
        ))}
      </div>
    </aside>
  )
}
