import { PremiumPaymentsOverviewBody } from './PremiumPaymentsOverviewBody'
import type { PremiumPaymentsOverviewViewProps } from './premiumPaymentsOverviewViewProps'

export default function PremiumPaymentsOverviewPCView(props: PremiumPaymentsOverviewViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--pc premium-payments-overview-page page--with-back">
      <header className="premium-payments-page__header">
        <h1>카드 수납</h1>
      </header>
      <PremiumPaymentsOverviewBody {...props} />
    </main>
  )
}
