import type { CustomerPremiumPaymentsState } from '../../hooks/useCustomerPremiumPaymentsState'

export type CustomerPremiumPaymentsViewProps = {
  customerId: number
  state: CustomerPremiumPaymentsState
  onConfirmDisable: (rowId: number) => Promise<void>
  onConfirmEnable: (rowId: number) => Promise<void>
}
