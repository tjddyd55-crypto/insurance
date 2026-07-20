import { useState } from 'react'
import { FormButton } from '../../../components/form'
import { CustomerRelationGroupsSection } from './CustomerRelationGroupsSection'
import { LegacyCustomerRelationsSection } from './LegacyCustomerRelationsSection'

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number, name?: string) => void
  focusedCustomerId: number | null
}

/**
 * 연계 고객 컨테이너.
 * - LegacyCustomerRelationsSection: 기존 1:1 (customer_relations)
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

  return (
    <section className="customer-relations-strip customer-relations-strip--in-detail">
      <div className="customer-relations-strip__header">
        <h4 className="customer-relations-strip__title">연계 고객</h4>
        <div className="customer-relations-strip__header-actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            onClick={() => setGroupCreateOpen(true)}
          >
            가족 그룹 만들기
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            onClick={() => setLegacyAddOpen(true)}
          >
            기존 연결
          </FormButton>
        </div>
      </div>

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
    </section>
  )
}
