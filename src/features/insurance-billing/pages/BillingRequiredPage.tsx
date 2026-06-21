import { Link } from 'react-router-dom'
import '../insurance-billing.css'

export default function BillingRequiredPage() {
  return (
    <main className="insurance-billing-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-card">
          <h1>결제가 필요합니다</h1>
          <p className="insurance-billing-plan-note">
            서비스 이용을 위해 결제가 필요합니다.
            <br />
            요금제를 선택하고 결제를 완료하면 보험 CRM을 바로 사용할 수 있습니다.
          </p>
          <Link to="/billing/checkout" className="insurance-billing-cta">
            결제하러 가기
          </Link>
          <Link to="/feature-request" className="insurance-billing-cta insurance-billing-cta--secondary">
            문의하기
          </Link>
        </div>
      </div>
    </main>
  )
}
