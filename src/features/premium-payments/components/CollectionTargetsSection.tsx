import { FormButton } from '../../../components/form'
import {
  formatPaymentDay,
  formatPremiumAmount,
  type CardPaymentContractRow,
} from '../api/premiumPaymentsApi'
import { formatLinkedCardLabel } from '../utils/formatLinkedCardLabel.js'
import { CardPaymentRowActions } from './CardPaymentRowActions'

type Props = {
  contracts: CardPaymentContractRow[]
  busy: boolean
  actionVariant?: 'workspace' | 'form'
  onCreate: () => void
  onEdit: (row: CardPaymentContractRow) => void
  onDelete: (contractId: number) => void
  onCopyPolicyNumber: (value: string | null | undefined) => void
}

/** 카드 수납 대상 섹션 — section header 액션 + compact 테이블 */
export function CollectionTargetsSection({
  contracts,
  busy,
  actionVariant = 'workspace',
  onCreate,
  onEdit,
  onDelete,
  onCopyPolicyNumber,
}: Props) {
  return (
    <section className="premium-payments-section" aria-labelledby="contract-heading">
      <div className="premium-payments-section__header">
        <h2 id="contract-heading">카드 수납 대상</h2>
        <FormButton htmlType="button" variant="primary" size="sm" onClick={onCreate} disabled={busy}>
          수납 대상 추가
        </FormButton>
      </div>
      {contracts.length === 0 ? (
        <div className="premium-payments-empty-block">
          <p className="premium-payments-page__empty">등록된 카드 수납 대상이 없습니다.</p>
          <FormButton htmlType="button" variant="primary" size="sm" onClick={onCreate} disabled={busy}>
            수납 대상 추가
          </FormButton>
        </div>
      ) : (
        <div className="premium-payments-table-wrap">
          <table className="premium-payments-table">
            <thead>
              <tr>
                <th className="premium-payments-table__col--company">보험회사</th>
                <th className="premium-payments-table__col--policy">증권번호</th>
                <th className="premium-payments-table__col--product">상품명</th>
                <th className="premium-payments-table__col--amount">보험료</th>
                <th className="premium-payments-table__col--day">결제일</th>
                <th className="premium-payments-table__col--card">사용 카드</th>
                <th className="premium-payments-table__col--actions">관리</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((row) => {
                const cardLabel = formatLinkedCardLabel(row.card)
                return (
                  <tr key={row.id}>
                    <td className="premium-payments-table__col--company" data-label="보험회사">
                      {row.insuranceCompany}
                    </td>
                    <td className="premium-payments-table__col--policy" data-label="증권번호">
                      {row.policyNumber ? (
                        <span className="premium-payments-inline-value">
                          <span className="premium-payments-ellipsis" title={row.policyNumber}>
                            {row.policyNumber}
                          </span>
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onCopyPolicyNumber(row.policyNumber)}
                          >
                            복사
                          </FormButton>
                        </span>
                      ) : (
                        '증권번호 없음'
                      )}
                    </td>
                    <td
                      className="premium-payments-table__col--product"
                      data-label="상품명"
                      title={row.productName || undefined}
                    >
                      <span className="premium-payments-ellipsis">{row.productName || '-'}</span>
                    </td>
                    <td className="premium-payments-table__col--amount" data-label="보험료">
                      {formatPremiumAmount(row.premiumAmount)}
                    </td>
                    <td className="premium-payments-table__col--day" data-label="결제일">
                      {formatPaymentDay(row.paymentDay)}
                    </td>
                    <td
                      className="premium-payments-table__col--card"
                      data-label="사용 카드"
                      title={cardLabel}
                    >
                      <span className="premium-payments-ellipsis">{cardLabel}</span>
                    </td>
                    <td className="premium-payments-table__col--actions" data-label="관리">
                      <CardPaymentRowActions
                        variant={actionVariant}
                        disabled={busy}
                        onEdit={() => onEdit(row)}
                        onDelete={() => onDelete(row.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
