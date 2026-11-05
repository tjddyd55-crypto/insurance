import { FormInput } from '../../../../components/form'
import type { InsurerCustomerGroup, InsurerGroupKey, InsurerGroupOption } from '../../domain/insurerGrouping'
import type {
  CardPaymentCustomerListItem,
  CardPaymentOverviewViewMode,
} from '../../hooks/usePremiumPaymentsOverviewState'

export type InsurerViewProps = {
  viewMode: CardPaymentOverviewViewMode
  onViewModeChange: (mode: CardPaymentOverviewViewMode) => void
  /** 검색 적용된 보험사 목록 (데이터 있는 보험사만) */
  insurerOptions: InsurerGroupOption[]
  /** 검색 전 전체 보험사 수 (빈 상태 문구용) */
  insurerTotalCount: number
  selectedInsurerKey: InsurerGroupKey | null
  selectedInsurer: InsurerGroupOption | null
  onSelectInsurer: (key: InsurerGroupKey) => void
  insurerSearch: string
  onInsurerSearchChange: (value: string) => void
  insurerCustomerGroups: InsurerCustomerGroup[]
  /** 보험사별 오른쪽에서 고객 카드 수납(수정 폼)으로 이동 */
  onOpenCustomerCards: (customerId: number) => void
}

type Props = {
  customers: CardPaymentCustomerListItem[]
  totalCount: number
  loading: boolean
  error: string
  search: string
  selectedCustomerId: number | null
  onSearchChange: (value: string) => void
  onSelectCustomer: (customerId: number) => void
  insurerView?: InsurerViewProps
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone || '연락처 없음'
}

export function PremiumPaymentsCustomerSidebar({
  customers,
  totalCount,
  loading,
  error,
  search,
  selectedCustomerId,
  onSearchChange,
  onSelectCustomer,
  insurerView,
}: Props) {
  const insurerMode = insurerView?.viewMode === 'insurer'
  return (
    <aside className="premium-payments-workspace__sidebar" aria-labelledby="card-payment-customers-heading">
      <div className="premium-payments-workspace__sidebar-head">
        <h2 id="card-payment-customers-heading" data-testid="card-sidebar-title">
          {insurerMode ? '보험회사' : '카드 수납 고객'}
        </h2>
        {insurerView ? (
          <div className="premium-payments-view-toggle" role="tablist" aria-label="보기 방식">
            {(
              [
                ['customer', '고객별'],
                ['insurer', '보험사별'],
              ] as const
            ).map(([mode, label]) => (
              /* eslint-disable-next-line no-restricted-syntax -- 보기 전환 탭(role=tab): 기존 BEM 토글 스타일 유지용 네이티브 button */
              <button
                key={mode}
                type="button"
                role="tab"
                data-testid={`card-view-${mode}`}
                aria-selected={insurerView.viewMode === mode}
                className={[
                  'premium-payments-view-toggle__btn',
                  insurerView.viewMode === mode ? 'premium-payments-view-toggle__btn--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => insurerView.onViewModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="premium-payments-workspace__search">
          {insurerView && insurerMode ? (
            <FormInput
              type="search"
              data-testid="card-sidebar-search"
              value={insurerView.insurerSearch}
              onChange={(e) => insurerView.onInsurerSearchChange(e.target.value)}
              placeholder="보험회사 검색"
              aria-label="보험회사 검색"
            />
          ) : (
            <FormInput
              type="search"
              data-testid="card-sidebar-search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="고객명 또는 연락처 검색"
              aria-label="고객명 또는 연락처 검색"
            />
          )}
        </div>
      </div>

      {loading ? <p className="premium-payments-page__hint">불러오는 중…</p> : null}
      {error ? (
        <p className="premium-payments-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && insurerView && insurerMode ? (
        insurerView.insurerOptions.length === 0 ? (
          <p className="premium-payments-page__empty">
            {insurerView.insurerTotalCount === 0 ? '카드 수납 대상이 없습니다.' : '검색 결과가 없습니다.'}
          </p>
        ) : (
          <ul className="premium-payments-customer-list" role="listbox" aria-label="보험회사" data-testid="card-insurer-list">
            {insurerView.insurerOptions.map((option) => {
              const active = insurerView.selectedInsurerKey === option.key
              return (
                <li key={option.key}>
                  {/* eslint-disable-next-line no-restricted-syntax -- 보험회사 목록 항목(role=option): 고객 목록과 동일 BEM 스타일 유지용 네이티브 button */}
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-testid="card-insurer-item"
                    data-insurer-key={option.key}
                    className={[
                      'premium-payments-customer-list__item',
                      'premium-payments-customer-list__item--insurer',
                      active ? 'premium-payments-customer-list__item--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => insurerView.onSelectInsurer(option.key)}
                  >
                    <span className="premium-payments-customer-list__name">{option.label}</span>
                    <span className="premium-payments-customer-list__count" data-testid="card-insurer-count">
                      {option.count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : null}

      {!loading && !error && !insurerMode ? (
        customers.length === 0 ? (
          <p className="premium-payments-page__empty">
            {totalCount === 0
              ? '카드 수납 대상이 등록된 고객이 없습니다.'
              : '검색 결과가 없습니다.'}
          </p>
        ) : (
          <ul className="premium-payments-customer-list" role="listbox" aria-label="카드 수납 고객">
            {customers.map((customer) => {
              const active = selectedCustomerId === customer.customerId
              return (
                <li key={customer.customerId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={[
                      'premium-payments-customer-list__item',
                      active ? 'premium-payments-customer-list__item--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onSelectCustomer(customer.customerId)}
                  >
                    <span className="premium-payments-customer-list__name">{customer.customerName}</span>
                    <span className="premium-payments-customer-list__meta">
                      {formatPhone(customer.customerPhone)} · {customer.targetCount}건
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : null}
    </aside>
  )
}
