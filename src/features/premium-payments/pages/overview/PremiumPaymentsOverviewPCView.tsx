import { PremiumPaymentsOverviewBody } from './PremiumPaymentsOverviewBody'
import type { PremiumPaymentsOverviewViewProps } from './premiumPaymentsOverviewViewProps'

export default function PremiumPaymentsOverviewPCView(props: PremiumPaymentsOverviewViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--pc premium-payments-overview-page page--with-back">
      <header className="premium-payments-page__header">
        <h1>보험료 결제</h1>
        <p>접근 가능한 고객의 보험료 결제 정보를 검색합니다. 카드번호는 마스킹만 표시됩니다.</p>
      </header>
      <PremiumPaymentsOverviewBody {...props} />
    </main>
  )
}
