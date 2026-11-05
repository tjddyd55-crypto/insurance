import { FormButton } from '../../../../components/form'
import { CollectionTargetsTable } from '../../components/CollectionTargetsTable'
import { INSURER_GROUP_OTHER } from '../../domain/insurerGrouping'
import type { InsurerViewProps } from './PremiumPaymentsCustomerSidebar'

type Props = {
  insurerView: InsurerViewProps
  onCopyPolicyNumber: (value: string | null | undefined) => void
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone || '연락처 없음'
}

/** 보험사별 보기 오른쪽: 선택 보험회사 → 고객(가나다, 1회) → 기존 카드 수납 테이블 */
export function PremiumPaymentsInsurerDetail({ insurerView, onCopyPolicyNumber }: Props) {
  const insurer = insurerView.selectedInsurer
  if (!insurer) {
    return (
      <div className="premium-payments-workspace__detail-empty">
        <p>{insurerView.insurerTotalCount === 0 ? '카드 수납 대상이 없습니다.' : '왼쪽에서 보험회사를 선택해 주세요.'}</p>
      </div>
    )
  }
  const groups = insurerView.insurerCustomerGroups
  const contractCount = groups.reduce((sum, g) => sum + g.contracts.length, 0)
  return (
    <div data-testid="card-insurer-detail">
      <header className="premium-payments-workspace__detail-head">
        <div>
          <h2 className="premium-payments-workspace__detail-title" data-testid="card-insurer-detail-title">
            {insurer.label}
            <span className="premium-payments-workspace__detail-phone" data-testid="card-insurer-detail-summary">
              {' '}
              · 총 {groups.length}명 · {contractCount}건
            </span>
          </h2>
          {insurer.key === INSURER_GROUP_OTHER ? (
            <p className="premium-payments-page__hint">보험회사 목록에 연결되지 않은 기존 입력값입니다.</p>
          ) : null}
        </div>
      </header>
      {groups.map((group) => (
        <section
          key={group.customerId}
          className="premium-payments-section premium-payments-insurer-customer"
          data-testid="card-insurer-customer-group"
          aria-label={group.customerName}
        >
          <div className="premium-payments-section__header">
            <h3 className="premium-payments-insurer-customer__name" data-testid="card-insurer-customer-name">
              {group.customerName}
              <span className="premium-payments-insurer-customer__phone"> {formatPhone(group.customerPhone)}</span>
            </h3>
            <FormButton
              htmlType="button"
              variant="secondary"
              size="sm"
              onClick={() => insurerView.onOpenCustomerCards(group.customerId)}
            >
              수정
            </FormButton>
          </div>
          <CollectionTargetsTable contracts={group.contracts} onCopyPolicyNumber={onCopyPolicyNumber} />
        </section>
      ))}
    </div>
  )
}
