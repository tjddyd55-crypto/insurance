import { CustomerWorkspaceMobileScope } from '../../../customers/components/CustomerWorkspaceActionButtons'
import { CustomerPremiumPaymentsBody } from './CustomerPremiumPaymentsBody'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export default function CustomerPremiumPaymentsMobileView(props: CustomerPremiumPaymentsViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--mobile page--with-back">
      <CustomerWorkspaceMobileScope>
        <header className="premium-payments-page__header">
          <h1>카드 수납</h1>
        </header>
        <CustomerPremiumPaymentsBody {...props} />
      </CustomerWorkspaceMobileScope>
    </main>
  )
}
