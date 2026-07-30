import type { CustomerCardPaymentState } from '../../hooks/useCustomerPremiumPaymentsState'

export type CustomerPremiumPaymentsViewProps = {
  customerId: number
  customerName: string
  state: CustomerCardPaymentState
  onConfirmDeleteCard: (cardId: number) => Promise<void>
  onConfirmDeleteContract: (contractId: number) => Promise<void>
  onConfirmComplete: (contractId: number) => Promise<void>
  onConfirmReopen: (contractId: number) => Promise<void>
}
