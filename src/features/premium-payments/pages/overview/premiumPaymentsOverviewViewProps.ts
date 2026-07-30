import type { PremiumPaymentsOverviewState } from '../../hooks/usePremiumPaymentsOverviewState'
import type { CardPaymentContractRow } from '../../api/premiumPaymentsApi'

export type PremiumPaymentsOverviewViewProps = PremiumPaymentsOverviewState & {
  onOpenCustomer: (customerId: number) => void
  onConfirmComplete: (row: CardPaymentContractRow) => Promise<void>
  onConfirmReopen: (row: CardPaymentContractRow) => Promise<void>
}
