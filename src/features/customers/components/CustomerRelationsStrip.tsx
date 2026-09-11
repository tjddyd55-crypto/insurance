import { useState } from 'react'
import { FormButton } from '../../../components/form'
import { CustomerRelationGroupsSection } from './CustomerRelationGroupsSection'
import { LegacyCustomerRelationsSection } from './LegacyCustomerRelationsSection'
import { CustomerCollapsibleSection } from './CustomerCollapsibleSection'

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number, name?: string) => void
  focusedCustomerId: number | null
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
}: Props) {
  const [legacyAddOpen, setLegacyAddOpen] = useState(false)
  const [groupCreateOpen, setGroupCreateOpen] = useState(false)

  const headerExtra = (
    <>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        className="customer-relations-strip__action-btn"
        onClick={() => setGroupCreateOpen(true)}
        title="가족 그룹 만들기"
        aria-label="가족 그룹 만들기"
      >
        가족 그룹 만들기
      </FormButton>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        className="customer-relations-strip__action-btn"
        onClick={() => setLegacyAddOpen(true)}
        title="개별 연결"
        aria-label="개별 연결"
      >
        개별 연결
      </FormButton>
    </>
  )

  return (
    <CustomerCollapsibleSection
      sectionId="linked"
      title="연계 고객"
      headingId="customer-relations-strip-heading"
      defaultExpanded
      className="customer-relations-strip customer-relations-strip--in-detail"
      headerExtra={headerExtra}
    >
      <div className="customer-relations-strip__body">
        <CustomerRelationGroupsSection
          customerId={customerId}
          customerName={customerName}
          token={token}
          onOpenCustomer={onOpenCustomer}
          focusedCustomerId={focusedCustomerId}
          createOpen={groupCreateOpen}
          onCreateOpenChange={setGroupCreateOpen}
        />
        <LegacyCustomerRelationsSection
          customerId={customerId}
          customerName={customerName}
          token={token}
          onOpenCustomer={onOpenCustomer}
          focusedCustomerId={focusedCustomerId}
          addOpen={legacyAddOpen}
          onAddOpenChange={setLegacyAddOpen}
        />
      </div>
    </CustomerCollapsibleSection>
  )
}
