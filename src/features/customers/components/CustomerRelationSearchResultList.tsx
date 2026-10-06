import { formatCustomerBirthDateDot, formatCustomerPhoneUi } from '../utils/customerDisplayFormat'
import { parseBirthDateFromRrn } from '../utils/insuranceAge'

export type CustomerRelationSearchHitStatus = {
  disabled?: boolean
  badge?: string | null
  selected?: boolean
}

/**
 * 검색 결과 행이 공통으로 쓰는 최소 필드.
 * 연계 고객(`CustomerRecord`)과 보장 시뮬레이션 고객 목록이 같이 만족한다.
 * 콜백의 hit 타입은 호출부가 넘긴 배열 원소 타입을 그대로 유지한다.
 */
export type CustomerSearchResultHit = {
  id: string | number
  name: string
  phone?: string | null
  birthDate?: string | Date | null
  ssn?: string | null
}

export type CustomerRelationSearchResultListProps<T extends CustomerSearchResultHit> = {
  hits: T[]
  busy?: boolean
  /** 검색어가 비어 있을 때 안내 (null 이면 결과 영역 숨김) */
  idleHint?: string | null
  emptyText?: string
  resolveStatus: (hit: T) => CustomerRelationSearchHitStatus
  onSelect: (hit: T) => void
  /** aria-label 접미사 — 예: "선택" / "연결" */
  actionLabel?: string
}

/** 주민번호 앞 7자리 → YYYY.MM.DD. 파싱 불가면 `-`. */
export function formatBirthYmdDotFromSsn(ssn: string | null | undefined): string {
  const birthDate = parseBirthDateFromRrn(String(ssn ?? ''))
  if (!birthDate) return '-'
  const y = String(birthDate.getFullYear())
  const m = String(birthDate.getMonth() + 1).padStart(2, '0')
  const d = String(birthDate.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

/**
 * 검색 행 생년월일. `birthDate`(customers.birth_date)가 있으면 그걸 쓰고,
 * 없을 때만 주민번호에서 파생한다. 둘 다 없으면 `-`.
 */
export function formatCustomerSearchBirthLabel(
  birthDate: string | Date | null | undefined,
  ssn?: string | null,
): string {
  const fromColumn = formatCustomerBirthDateDot(birthDate)
  if (fromColumn) return fromColumn
  return formatBirthYmdDotFromSsn(ssn)
}

/**
 * 연계 고객(1:1 · 가족 그룹) 공통 검색 결과.
 * PC: 이름/생년월일/연락처 테이블 · Mobile: compact 카드 행.
 * 두 마크업을 같이 두고 CSS 로 플랫폼만 전환한다 (portal 에서도 동작).
 */
export function CustomerRelationSearchResultList<T extends CustomerSearchResultHit>({
  hits,
  busy = false,
  idleHint = null,
  emptyText = '검색 결과가 없습니다.',
  resolveStatus,
  onSelect,
  actionLabel = '선택',
}: CustomerRelationSearchResultListProps<T>) {
  if (idleHint) {
    return (
      <div className="customer-relations-modal__results">
        <p className="customer-relations-modal__search-status">{idleHint}</p>
      </div>
    )
  }

  if (busy) {
    return (
      <div className="customer-relations-modal__results">
        <p className="customer-relations-modal__search-status">검색 중…</p>
      </div>
    )
  }

  return (
    <div className="customer-relations-modal__results">
      <ul className="customer-relations-result-list" aria-label="검색 결과">
        {hits.map((h) => {
          const status = resolveStatus(h)
          const birth = formatCustomerSearchBirthLabel(h.birthDate, h.ssn)
          const phone = formatCustomerPhoneUi(h.phone) || '-'
          const disabled = Boolean(status.disabled)
          return (
            <li key={h.id} className="customer-relations-result-list__item">
              <button
                type="button"
                className={`customer-relations-result-item${
                  disabled ? ' customer-relations-result-item--linked' : ''
                }${status.selected ? ' customer-relations-result-item--selected' : ''}`}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  onSelect(h)
                }}
                aria-label={`${h.name} ${actionLabel}`}
                aria-pressed={status.selected ? true : undefined}
              >
                <span className="customer-relations-result-item__main">
                  <span className="customer-relations-result-item__name">{h.name}</span>
                  {status.badge ? (
                    <span className="ui-status-badge ui-status-badge--success">{status.badge}</span>
                  ) : null}
                  {status.selected && !status.badge ? (
                    <span className="ui-status-badge ui-status-badge--success">선택됨</span>
                  ) : null}
                </span>
                <span className="customer-relations-result-item__sub">
                  <span className="customer-relations-result-item__birth">{birth}</span>
                  <span className="customer-relations-result-item__dot" aria-hidden>
                    ·
                  </span>
                  <span className="customer-relations-result-item__phone">{phone}</span>
                </span>
              </button>
            </li>
          )
        })}
        {hits.length === 0 ? (
          <li className="customer-relations-result-list__item customer-relations-result-list__empty">
            {emptyText}
          </li>
        ) : null}
      </ul>

      <div className="related-list related-list--pc customer-relations-related-list">
        <div className="related-list__header row" role="presentation">
          <div className="name">이름</div>
          <div className="birth">생년월일</div>
          <div className="phone">연락처</div>
        </div>
        <ul className="related-list__body" role="list">
          {hits.map((h) => {
            const status = resolveStatus(h)
            const birth = formatCustomerSearchBirthLabel(h.birthDate, h.ssn)
            const phone = formatCustomerPhoneUi(h.phone) || '-'
            const disabled = Boolean(status.disabled)
            const trigger = () => {
              if (disabled) return
              onSelect(h)
            }
            return (
              <li
                key={h.id}
                className={`row related-list__row${disabled ? ' related-list__row--disabled' : ''}${
                  status.selected ? ' related-list__row--selected' : ''
                }`}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                aria-label={`${h.name} ${actionLabel}`}
                aria-pressed={status.selected ? true : undefined}
                onClick={trigger}
                onKeyDown={(e) => {
                  if (disabled) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    trigger()
                  }
                }}
              >
                <div className="name" title={h.name}>
                  {h.name}
                </div>
                <div className="birth">{birth}</div>
                <div className="phone">
                  <span>{phone}</span>
                  {status.badge ? (
                    <span className="related-list__linked" aria-label={status.badge}>
                      {status.badge}
                    </span>
                  ) : null}
                  {status.selected && !status.badge ? (
                    <span className="related-list__linked" aria-label="선택됨">
                      선택됨
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
          {hits.length === 0 ? <li className="related-list__empty">{emptyText}</li> : null}
        </ul>
      </div>
    </div>
  )
}
