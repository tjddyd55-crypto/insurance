import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { resolveAuthLandingPath } from '../../auth/landing'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { fetchBillingManageSummary } from '../api/insuranceBillingApi'
import { isBillingSuccessEntitledStatus } from '../billingApplyPromotion'
import '../insurance-billing.css'

type VerifyState = 'loading' | 'verified' | 'failed'

export default function BillingSuccessPage() {
  const location = useLocation()
  const { token, user } = useAuth()
  const isMobile = useIsMobile()
  const state = (location.state ?? {}) as { mode?: string; trialEndsAt?: string }
  const landing = resolveAuthLandingPath(isMobile, user?.role)
  const [verifyState, setVerifyState] = useState<VerifyState>('loading')
  const [verifiedTrialEndsAt, setVerifiedTrialEndsAt] = useState<string | null>(null)

  useEffect(() => {
    if (!token?.trim()) {
      setVerifyState('failed')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchBillingManageSummary(token)
        const status = data.summary?.subscriptionStatus
        if (!isBillingSuccessEntitledStatus(status)) {
          if (!cancelled) {
            setVerifyState('failed')
          }
          return
        }
        if (!cancelled) {
          setVerifyState('verified')
          setVerifiedTrialEndsAt(data.summary.trialEndsAt ?? state.trialEndsAt ?? null)
        }
      } catch {
        if (!cancelled) {
          setVerifyState('failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, state.trialEndsAt])

  if (verifyState === 'loading') {
    return (
      <main className="insurance-billing-page">
        <div className="insurance-billing-page__shell">
          <div className="insurance-billing-card">
            <p className="insurance-billing-plan-note">결제 상태를 확인하는 중...</p>
          </div>
        </div>
      </main>
    )
  }

  if (verifyState === 'failed') {
    return (
      <main className="insurance-billing-page">
        <div className="insurance-billing-page__shell">
          <div className="insurance-billing-card">
            <h1>무료 이용권 적용이 완료되지 않았습니다.</h1>
            <p className="insurance-billing-plan-note">
              결제 상태가 아직 반영되지 않았습니다. checkout 화면에서 코드 확인 후 다시 적용해 주세요.
            </p>
            <Link to="/billing/checkout" className="insurance-billing-cta">
              checkout으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const trialEndsAt = verifiedTrialEndsAt ?? state.trialEndsAt

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
          {trialEndsAt ? (
            <div className="insurance-billing-notice">무료 종료일: {trialEndsAt.slice(0, 10)}</div>
          ) : null}
          <Link to={landing} className="insurance-billing-cta">
            CRM 시작하기
          </Link>
        </div>
      </div>
    </main>
  )
}
