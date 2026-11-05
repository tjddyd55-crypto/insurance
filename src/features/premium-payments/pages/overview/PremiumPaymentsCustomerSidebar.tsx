import { FormInput, FormSelect } from '../../../../components/form'
import type { InsurerCustomerGroup, InsurerGroupKey, InsurerGroupOption } from '../../domain/insurerGrouping'
import type {
  CardPaymentCustomerListItem,
  CardPaymentOverviewViewMode,
} from '../../hooks/usePremiumPaymentsOverviewState'

export type InsurerViewProps = {
  viewMode: CardPaymentOverviewViewMode
  onViewModeChange: (mode: CardPaymentOverviewViewMode) => void
  insurerOptions: InsurerGroupOption[]
  selectedInsurerKey: InsurerGroupKey | null
  onSelectInsurer: (key: InsurerGroupKey) => void
  insurerCustomerGroups: InsurerCustomerGroup[]
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

function formatWon(n: number | null): string {
  return n == null ? '' : `${n.toLocaleString('ko-KR')}원`
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
        <h2 id="card-payment-customers-heading">카드 수납 고객</h2>
        {insurerView ? (
          <div className="premium-payments-view-toggle" role="tablist" aria-label="보기 방식">
            {(
              [
                ['customer', '고객별'],
                ['insurer', '보험사별'],
              ] as const
            ).map(([mode, label]) => (
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
        {insurerView && insurerMode ? (
          <div className="premium-payments-workspace__insurer-select">
            <FormSelect
              data-testid="card-insurer-filter"
              aria-label="보험사 선택"
              value={insurerView.selectedInsurerKey ?? ''}
              onChange={(e) => insurerView.onSelectInsurer(e.target.value as InsurerGroupKey)}
              options={insurerView.insurerOptions.map((o) => ({
                value: o.key,
                label: `${o.category === 'LIFE' ? '[생명] ' : o.category === 'NON_LIFE' ? '[손해] ' : ''}${o.label} (${o.count})`,
              }))}
            />
          </div>
        ) : null}
        <div className="premium-payments-workspace__search">
          <FormInput
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="고객명 또는 연락처 검색"
            aria-label="고객명 또는 연락처 검색"
          />
        </div>
      </div>

      {loading ? <p className="premium-payments-page__hint">불러오는 중…</p> : null}
      {error ? (
        <p className="premium-payments-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && insurerView && insurerMode ? (
        insurerView.insurerCustomerGroups.length === 0 ? (
          <p className="premium-payments-page__empty">
            {search.trim() ? '검색 결과가 없습니다.' : '선택한 보험사의 수납 대상이 없습니다.'}
          </p>
        ) : (
          <ul className="premium-payments-customer-list" role="listbox" aria-label="보험사별 고객" data-testid="card-insurer-groups">
            {insurerView.insurerCustomerGroups.map((group) => {
              const active = selectedCustomerId === group.customerId
              return (
                <li key={group.customerId} data-testid="card-insurer-customer-group">
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
                    onClick={() => onSelectCustomer(group.customerId)}
                  >
                    <span className="premium-payments-customer-list__name">{group.customerName}</span>
                    <span className="premium-payments-customer-list__meta">
                      {formatPhone(group.customerPhone)} · {group.contracts.length}건
                    </span>
                  </button>
                  <ul className="premium-payments-insurer-contracts">
                    {group.contracts.map((c) => (
                      <li key={c.id} className="premium-payments-insurer-contracts__item" data-testid="card-insurer-contract">
                        <span>{c.productName || c.insuranceCompany || '상품명 없음'}</span>
                        <span className="premium-payments-insurer-contracts__meta">
                          {[c.policyNumber, formatWon(c.premiumAmount), c.paymentDay ? `매월 ${c.paymentDay}일` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
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
