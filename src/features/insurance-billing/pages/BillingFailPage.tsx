import { Link } from 'react-router-dom'
import '../insurance-billing.css'

export default function BillingFailPage() {
  return (
    <main className="insurance-billing-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-card">
          <h1>결제가 완료되지 않았습니다</h1>
          <p className="insurance-billing-plan-note">
            결제수단을 확인한 뒤 다시 시도해 주세요.
          </p>
          <Link to="/billing/checkout" className="insurance-billing-cta">
            다시 결제하기
          </Link>
          <Link to="/feature-request" className="insurance-billing-cta insurance-billing-cta--secondary">
            문의하기
          </Link>
        </div>
      </div>
    </main>
  )
}
