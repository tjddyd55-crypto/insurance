import { CustomerPremiumPaymentsBody } from './CustomerPremiumPaymentsBody'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export default function CustomerPremiumPaymentsPCView(props: CustomerPremiumPaymentsViewProps) {
  return (
    <main className="page premium-payments-page premium-payments-page--pc page--with-back">
      <header className="premium-payments-page__header">
        <h1>보험료 결제</h1>
        <p>고객별 보험료 결제 카드 정보를 관리합니다. 카드번호는 암호화 저장되며 목록에는 마스킹만 표시됩니다.</p>
      </header>
      <CustomerPremiumPaymentsBody {...props} />
    </main>
  )
}
