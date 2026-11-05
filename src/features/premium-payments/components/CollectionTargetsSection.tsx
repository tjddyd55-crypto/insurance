import { FormButton } from '../../../components/form'
import type { CardPaymentContractRow } from '../api/premiumPaymentsApi'
import { CollectionTargetsTable } from './CollectionTargetsTable'

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
        <CollectionTargetsTable
          contracts={contracts}
          busy={busy}
          actionVariant={actionVariant}
          onEdit={onEdit}
          onDelete={onDelete}
          onCopyPolicyNumber={onCopyPolicyNumber}
        />
      )}
    </section>
  )
}
