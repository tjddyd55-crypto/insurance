import { FormButton, FormInput, FormSelect } from '../../../../components/form'
import type { PremiumPaymentsOverviewViewProps } from './premiumPaymentsOverviewViewProps'
import '../../premium-payments.css'

export function PremiumPaymentsOverviewBody({ state, onOpenCustomer }: PremiumPaymentsOverviewViewProps) {
  const {
    rows,
    total,
    draftQ,
    setDraftQ,
    activeFilter,
    setActiveFilter,
    error,
    busy,
    formatCardExpiry,
    submitSearch,
  } = state

  return (
    <>
      <form
        className="premium-payments-overview-filters"
        onSubmit={(e) => {
          e.preventDefault()
          submitSearch()
        }}
      >
        <FormInput
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          placeholder="고객명·보험회사·증권번호·끝4자리"
        />
        <FormSelect
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
          options={[
            { value: 'all', label: '전체 상태' },
            { value: 'active', label: '사용중' },
            { value: 'inactive', label: '중지' },
          ]}
        />
        <FormButton htmlType="submit" variant="primary" disabled={busy}>
          검색
        </FormButton>
      </form>

      {error ? <p className="premium-payments-error">{error}</p> : null}
      <p className="premium-payments-overview-count">총 {total}건</p>

      {rows.length === 0 && !busy ? (
        <p className="premium-payments-empty">검색 결과가 없습니다.</p>
      ) : null}

      <div className="premium-payments-overview-table-wrap">
        <table className="premium-payments-overview-table">
          <thead>
            <tr>
              <th>고객</th>
              <th>보험회사</th>
              <th>증권번호</th>
              <th>명의자</th>
              <th>카드</th>
              <th>유효기간</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    type="button"
                    className="premium-payment-card__linkish"
                    onClick={() => onOpenCustomer(row.customerId)}
                  >
                    {row.customerName || `고객 #${row.customerId}`}
                  </button>
                </td>
                <td>{row.insuranceCompany}</td>
                <td>{row.policyNumber}</td>
                <td>{row.cardholderName}</td>
                <td>{row.maskedCardNumber}</td>
                <td>{formatCardExpiry(row.cardExpiryMonth, row.cardExpiryYear)}</td>
                <td>{row.isActive ? '사용중' : '중지'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="premium-payments-overview-cards">
        {rows.map((row) => (
          <article
            key={`m-${row.id}`}
            className={`premium-payment-card${row.isActive ? '' : ' premium-payment-card--inactive'}`}
          >
            <div className="premium-payment-card__head">
              <button
                type="button"
                className="premium-payment-card__linkish"
                onClick={() => onOpenCustomer(row.customerId)}
              >
                <strong>{row.customerName || `고객 #${row.customerId}`}</strong>
              </button>
              <span className={`premium-payment-card__badge${row.isActive ? '' : ' is-off'}`}>
                {row.isActive ? '사용중' : '중지'}
              </span>
            </div>
            <dl className="premium-payment-card__meta">
              <div>
                <dt>보험회사</dt>
                <dd>{row.insuranceCompany}</dd>
              </div>
              <div>
                <dt>카드</dt>
                <dd>{row.maskedCardNumber}</dd>
              </div>
              <div>
                <dt>유효기간</dt>
                <dd>{formatCardExpiry(row.cardExpiryMonth, row.cardExpiryYear)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  )
}
