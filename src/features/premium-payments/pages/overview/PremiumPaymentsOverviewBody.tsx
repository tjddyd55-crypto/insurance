import { FormButton, FormInput, FormSelect } from '../../../../components/form'
import { CardPaymentRowActions } from '../../components/CardPaymentRowActions'
import { formatPaymentDay, formatPremiumAmount } from '../../api/premiumPaymentsApi'
import { formatLinkedCardLabel } from '../../utils/formatLinkedCardLabel.js'
import type { PremiumPaymentsOverviewViewProps } from './premiumPaymentsOverviewViewProps'

const paymentDayOptions = [
  { value: '', label: '전체 결제일' },
  { value: 'today', label: '오늘' },
  { value: '1-10', label: '1~10일' },
  { value: '11-20', label: '11~20일' },
  { value: '21-31', label: '21~말일' },
  { value: 'missing', label: '결제일 미입력' },
]

function formatMonthTitle(month: string): string {
  const [y, m] = month.split('-')
  if (!y || !m) return month
  return `${y}년 ${Number(m)}월 카드 수납`
}

export function PremiumPaymentsOverviewBody(props: PremiumPaymentsOverviewViewProps) {
  const {
    search,
    setSearch,
    paymentDay,
    setPaymentDay,
    insuranceCompany,
    setInsuranceCompany,
    targetMonth,
    totalCount,
    groups,
    error,
    busy,
    copyHint,
    copyPolicyNumber,
    copyCardNumber,
    copyCardExpiry,
    onOpenCustomer,
    onConfirmDeleteContract,
    reload,
  } = props

  return (
    <div className="premium-payments-overview">
      <div className="premium-payments-toolbar">
        <label>
          검색
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명·연락처·보험회사·증권번호·끝4자리"
          />
        </label>
        <label>
          결제일
          <FormSelect
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
            options={paymentDayOptions}
          />
        </label>
        <label>
          보험회사
          <FormInput
            value={insuranceCompany}
            onChange={(e) => setInsuranceCompany(e.target.value)}
            placeholder="보험회사"
          />
        </label>
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void reload()} disabled={busy}>
          새로고침
        </FormButton>
      </div>

      <h2 className="premium-payments-overview__title">{formatMonthTitle(targetMonth)}</h2>
      <div className="premium-payments-summary">
        <div className="premium-payments-summary__item">전체 {totalCount}건</div>
      </div>

      {error ? (
        <p className="premium-payments-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {copyHint ? <p className="premium-payments-page__hint">{copyHint}</p> : null}

      {groups.length === 0 ? (
        <p className="premium-payments-page__empty">표시할 카드 수납 대상이 없습니다.</p>
      ) : (
        <div className="premium-payments-groups">
          {groups.map((group) => (
            <section key={group.customerId} className="premium-payments-group">
              <header className="premium-payments-group__header">
                <div>
                  <button
                    type="button"
                    className="premium-payments-group__customer-link"
                    onClick={() => onOpenCustomer(group.customerId)}
                  >
                    {group.customerName}
                  </button>
                  <span className="premium-payments-group__phone">
                    {group.customerPhone || '연락처 없음'}
                  </span>
                  {group.ownerDisplayName ? (
                    <span className="premium-payments-group__owner">담당 {group.ownerDisplayName}</span>
                  ) : null}
                </div>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenCustomer(group.customerId)}
                >
                  고객 보기
                </FormButton>
              </header>
              <ul className="premium-payments-group__contracts">
                {group.contracts.map((row) => (
                  <li key={row.id} className="premium-payments-group__contract">
                    <div className="premium-payments-group__contract-main">
                      <strong>{row.insuranceCompany}</strong>
                      <span>
                        {row.policyNumber ? `증권번호 ${row.policyNumber}` : '증권번호 없음'}
                      </span>
                      <span>{row.productName || '상품명 미입력'}</span>
                      <span>{formatPremiumAmount(row.premiumAmount)}</span>
                      <span>{formatPaymentDay(row.paymentDay)}</span>
                      <span>{formatLinkedCardLabel(row.card)}</span>
                    </div>
                    <div className="premium-payments-inline-actions">
                      {row.policyNumber ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void copyPolicyNumber(row.policyNumber)}
                        >
                          증권번호 복사
                        </FormButton>
                      ) : null}
                      {row.card?.cardNumber ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void copyCardNumber(row.card?.cardNumber)}
                        >
                          카드번호 복사
                        </FormButton>
                      ) : null}
                      {row.card?.cardExpiry ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void copyCardExpiry(row.card?.cardExpiry)}
                        >
                          유효기간 복사
                        </FormButton>
                      ) : null}
                      <CardPaymentRowActions
                        variant="form"
                        disabled={busy}
                        onEdit={() => onOpenCustomer(row.customerId)}
                        onDelete={() => void onConfirmDeleteContract(row)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
