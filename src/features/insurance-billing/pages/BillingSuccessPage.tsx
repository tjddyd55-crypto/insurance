import { Link, useLocation } from 'react-router-dom'
import { resolveAuthLandingPath } from '../../auth/landing'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import '../insurance-billing.css'

export default function BillingSuccessPage() {
  const location = useLocation()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const state = (location.state ?? {}) as { mode?: string; trialEndsAt?: string }
  const landing = resolveAuthLandingPath(isMobile, user?.role)

  return (
    <main className="insurance-billing-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-card">
          <h1>{state.mode === 'paid' ? '결제가 완료되었습니다' : '무료 이용이 시작되었습니다'}</h1>
          <p className="insurance-billing-plan-note">
            {state.mode === 'paid'
              ? '보험 CRM을 바로 사용할 수 있습니다.'
              : '무료 이용 기간 동안 모든 기능을 사용할 수 있습니다.'}
          </p>
          {state.trialEndsAt ? (
            <div className="insurance-billing-notice">무료 종료일: {state.trialEndsAt.slice(0, 10)}</div>
          ) : null}
          <Link to={landing} className="insurance-billing-cta">
            CRM 시작하기
          </Link>
        </div>
      </div>
    </main>
  )
}
