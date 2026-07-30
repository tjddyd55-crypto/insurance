import type { PremiumPaymentsOverviewState } from '../../hooks/usePremiumPaymentsOverviewState'
import type { CardPaymentContractRow } from '../../api/premiumPaymentsApi'

export type PremiumPaymentsOverviewViewProps = PremiumPaymentsOverviewState & {
  onOpenCustomer: (customerId: number) => void
  onConfirmDeleteContract: (row: CardPaymentContractRow) => Promise<void>
}
