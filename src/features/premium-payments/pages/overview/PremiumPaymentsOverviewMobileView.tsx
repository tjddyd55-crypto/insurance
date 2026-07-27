import { PremiumPaymentsOverviewBody } from './PremiumPaymentsOverviewBody'
import type { PremiumPaymentsOverviewViewProps } from './premiumPaymentsOverviewViewProps'

export default function PremiumPaymentsOverviewMobileView(props: PremiumPaymentsOverviewViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--mobile premium-payments-overview-page page--with-back">
      <header className="premium-payments-page__header">
        <h1>보험료 결제</h1>
      </header>
      <PremiumPaymentsOverviewBody {...props} />
    </main>
  )
}
