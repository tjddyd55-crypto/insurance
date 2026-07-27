import { CustomerPremiumPaymentsBody } from './CustomerPremiumPaymentsBody'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export default function CustomerPremiumPaymentsMobileView(props: CustomerPremiumPaymentsViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--mobile page--with-back">
      <header className="premium-payments-page__header">
        <h1>보험료 결제</h1>
      </header>
      <CustomerPremiumPaymentsBody {...props} />
    </main>
  )
}
