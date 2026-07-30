import { FormInput } from '../../../../components/form'
import type { CardPaymentCustomerListItem } from '../../hooks/usePremiumPaymentsOverviewState'

type Props = {
  customers: CardPaymentCustomerListItem[]
  totalCount: number
  loading: boolean
  error: string
  search: string
  selectedCustomerId: number | null
  onSearchChange: (value: string) => void
  onSelectCustomer: (customerId: number) => void
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
}: Props) {
  return (
    <aside className="premium-payments-workspace__sidebar" aria-labelledby="card-payment-customers-heading">
      <div className="premium-payments-workspace__sidebar-head">
        <h2 id="card-payment-customers-heading">카드 수납 고객</h2>
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

      {!loading && !error ? (
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
