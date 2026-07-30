import { CustomerPremiumPaymentsBody } from './CustomerPremiumPaymentsBody'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export default function CustomerPremiumPaymentsPCView(props: CustomerPremiumPaymentsViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--pc page--with-back">
      <header className="premium-payments-page__header">
        <h1>카드 수납</h1>
        <p>카드로 직접 수납해야 하는 보험계약과 고객 카드정보를 관리합니다.</p>
      </header>
      <CustomerPremiumPaymentsBody {...props} />
    </main>
  )
}
