import { CustomerPremiumPaymentsBody } from './CustomerPremiumPaymentsBody'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export default function CustomerPremiumPaymentsPCView(props: CustomerPremiumPaymentsViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--pc page--with-back">
      <header className="premium-payments-page__header">
        <h1>카드 수납</h1>
      </header>
      <CustomerPremiumPaymentsBody {...props} />
    </main>
  )
}
