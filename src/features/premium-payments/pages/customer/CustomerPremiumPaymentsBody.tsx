import { OverlayToast } from '../../../../components/OverlayToast'
import { CustomerCardPaymentPanels } from '../../components/CustomerCardPaymentPanels'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export function CustomerPremiumPaymentsBody({
  customerName,
  state,
  onConfirmDeleteCard,
  onConfirmDeleteContract,
}: CustomerPremiumPaymentsViewProps) {
  return (
    <>
      <CustomerCardPaymentPanels
        state={state}
        customerName={customerName}
        actionVariant="workspace"
        onConfirmDeleteCard={onConfirmDeleteCard}
        onConfirmDeleteContract={onConfirmDeleteContract}
      />
      {state.copyFeedback ? (
        <OverlayToast
          key={state.copyFeedback.id}
          message={state.copyFeedback.message}
          className="premium-payments-copy-toast"
        />
      ) : null}
    </>
  )
}
