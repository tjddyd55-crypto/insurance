import { CustomerRelationGroupsSection } from './CustomerRelationGroupsSection'
import { LegacyCustomerRelationsSection } from './LegacyCustomerRelationsSection'

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number, name?: string) => void
  focusedCustomerId: number | null
  /** 고객 상세 아코디언 패널 안 — 섹션 제목과 중복되는 내부 heading 제거 */
  embedded?: boolean
}

/**
 * 연계 고객 컨테이너.
 * - LegacyCustomerRelationsSection: 기존 1:1 (customer_relations) — UI 문구는 "개별 연결"
 * - CustomerRelationGroupsSection: 가족 그룹 (relation-groups)
 * 두 기능의 모달·상태·API 를 섞지 않는다.
 */
export function CustomerRelationsStrip({
  customerId,
  customerName,
  token,
  onOpenCustomer,
  focusedCustomerId,
  embedded = false,
}: Props) {
  return (
    <section
      className={`customer-relations-strip customer-relations-strip--in-detail${
        embedded ? ' customer-relations-strip--accordion-embedded' : ''
      }`}
    >
      {!embedded ? <h4 className="customer-relations-strip__title">연계 고객</h4> : null}

      <div className="customer-relations-strip__body">
        <CustomerRelationGroupsSection
          customerId={customerId}
          customerName={customerName}
          token={token}
          onOpenCustomer={onOpenCustomer}
          focusedCustomerId={focusedCustomerId}
        />
        <LegacyCustomerRelationsSection
          customerId={customerId}
          customerName={customerName}
          token={token}
          onOpenCustomer={onOpenCustomer}
          focusedCustomerId={focusedCustomerId}
        />
      </div>
    </section>
  )
}
