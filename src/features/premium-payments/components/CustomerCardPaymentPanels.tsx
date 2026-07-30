import type { FormEvent } from 'react'
import type { CustomerCardPaymentState } from '../hooks/useCustomerPremiumPaymentsState'
import { CardPaymentFormDialog } from './CardPaymentFormDialog'
import { CollectionTargetForm } from './CollectionTargetForm'
import { CollectionTargetsSection } from './CollectionTargetsSection'
import { PaymentCardForm } from './PaymentCardForm'
import { PaymentCardsSection } from './PaymentCardsSection'

type Props = {
  state: CustomerCardPaymentState
  customerName?: string
  actionVariant?: 'workspace' | 'form'
  onConfirmDeleteCard: (cardId: number) => void | Promise<void>
  onConfirmDeleteContract: (contractId: number) => void | Promise<void>
  /** 큰 메뉴에서 좌측 targetCount 갱신 등 */
  onAfterMutate?: () => void | Promise<void>
  showMetaHints?: boolean
}

/** 고객 상세·큰 메뉴 우측에서 공유하는 카드정보/수납대상 + 모달 */
export function CustomerCardPaymentPanels({
  state,
  customerName = '',
  actionVariant = 'workspace',
  onConfirmDeleteCard,
  onConfirmDeleteContract,
  onAfterMutate,
  showMetaHints = true,
}: Props) {
  const {
    cards,
    contracts,
    error,
    busy,
    notFound,
    copyHint,
    cardFormOpen,
    editingCard,
    cardForm,
    setCardForm,
    openCreateCard,
    openEditCard,
    closeCardForm,
    submitCardForm,
    contractFormOpen,
    editingContract,
    contractForm,
    setContractForm,
    openCreateContract,
    openEditContract,
    closeContractForm,
    submitContractForm,
    copyPolicyNumber,
    copyCardNumber,
    copyCardExpiry,
    cardOptions,
  } = state

  if (notFound) {
    return <p className="premium-payments-page__error">고객을 찾을 수 없습니다.</p>
  }

  const handleSubmitCard = async (event: FormEvent) => {
    const ok = await submitCardForm(event)
    if (ok) await onAfterMutate?.()
  }

  const handleSubmitContract = async (event: FormEvent) => {
    const ok = await submitContractForm(event)
    if (ok) await onAfterMutate?.()
  }

  return (
    <div className="premium-payments-page__workspace">
      {showMetaHints && error ? (
        <p className="premium-payments-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {showMetaHints && copyHint ? <p className="premium-payments-page__hint">{copyHint}</p> : null}

      <PaymentCardsSection
        cards={cards}
        busy={busy}
        actionVariant={actionVariant}
        onCreate={openCreateCard}
        onEdit={openEditCard}
        onDelete={(cardId) => void onConfirmDeleteCard(cardId)}
        onCopyCardNumber={(digits) => void copyCardNumber(digits)}
        onCopyExpiry={(expiry) => void copyCardExpiry(expiry)}
      />

      <CollectionTargetsSection
        contracts={contracts}
        busy={busy}
        actionVariant={actionVariant}
        onCreate={openCreateContract}
        onEdit={openEditContract}
        onDelete={(contractId) => void onConfirmDeleteContract(contractId)}
        onCopyPolicyNumber={(value) => void copyPolicyNumber(value)}
      />

      <CardPaymentFormDialog
        open={cardFormOpen}
        onClose={closeCardForm}
        title={editingCard ? '카드정보 수정' : '카드정보 등록'}
        formId="card-payment-card-form"
        formClassName="premium-payments-form--card"
        size="card"
        busy={busy}
        onSubmit={handleSubmitCard}
      >
        <PaymentCardForm
          value={cardForm}
          onChange={setCardForm}
          editing={Boolean(editingCard)}
          ownerPlaceholder={customerName || '카드 소유주 입력'}
        />
      </CardPaymentFormDialog>

      <CardPaymentFormDialog
        open={contractFormOpen}
        onClose={closeContractForm}
        title={editingContract ? '카드 수납 대상 수정' : '카드 수납 대상 추가'}
        formId="card-payment-contract-form"
        formClassName="premium-payments-form--contract"
        size="contract"
        busy={busy}
        onSubmit={handleSubmitContract}
      >
        <CollectionTargetForm
          value={contractForm}
          onChange={setContractForm}
          cardOptions={cardOptions}
        />
      </CardPaymentFormDialog>
    </div>
  )
}
