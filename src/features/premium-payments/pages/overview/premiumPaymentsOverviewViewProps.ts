import type { PremiumPaymentsOverviewState } from '../../hooks/usePremiumPaymentsOverviewState'

export type PremiumPaymentsOverviewViewProps = {
  state: PremiumPaymentsOverviewState
  onOpenCustomer: (customerId: number) => void
}
