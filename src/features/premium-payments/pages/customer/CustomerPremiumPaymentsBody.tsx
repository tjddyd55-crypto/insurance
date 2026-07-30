import { CustomerCardPaymentPanels } from '../../components/CustomerCardPaymentPanels'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export function CustomerPremiumPaymentsBody({
  customerName,
  state,
  onConfirmDeleteCard,
  onConfirmDeleteContract,
}: CustomerPremiumPaymentsViewProps) {
  return (
    <CustomerCardPaymentPanels
      state={state}
      customerName={customerName}
      actionVariant="workspace"
      onConfirmDeleteCard={onConfirmDeleteCard}
      onConfirmDeleteContract={onConfirmDeleteContract}
    />
  )
}
