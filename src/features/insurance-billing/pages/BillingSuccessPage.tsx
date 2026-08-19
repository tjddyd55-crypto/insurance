import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { resolveAuthLandingPath } from '../../auth/landing'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { confirmBillingAuth, fetchBillingManageSummary, requestBillingPayment } from '../api/insuranceBillingApi'
import { isBillingSuccessEntitledStatus } from '../billingApplyPromotion'
import '../insurance-billing.css'

type VerifyState = 'loading' | 'verified' | 'failed'

export default function BillingSuccessPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { token, user } = useAuth()
  const isMobile = useIsMobile()
  const state = (location.state ?? {}) as { mode?: string; trialEndsAt?: string }
  const landing = resolveAuthLandingPath(isMobile, user?.role)
  const [verifyState, setVerifyState] = useState<VerifyState>('loading')
  const [verifiedTrialEndsAt, setVerifiedTrialEndsAt] = useState<string | null>(null)
  const [resultMode, setResultMode] = useState(state.mode ?? '')

  const authKey = String(searchParams.get('authKey') ?? '').trim()
  const customerKey = String(searchParams.get('customerKey') ?? '').trim()
  const intent = String(searchParams.get('intent') ?? 'charge').trim()
  const planCode = String(searchParams.get('planCode') ?? 'insurance_basic').trim()
  const billingCycle = String(searchParams.get('billingCycle') ?? 'monthly').trim()

  useEffect(() => {
    if (!token?.trim()) {
      setVerifyState('failed')
      return
    }
    if (state.mode === 'pending' && !authKey) {
      setVerifyState('verified')
      setResultMode('pending')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        if (authKey && customerKey) {
          await confirmBillingAuth(token, { authKey, customerKey })
          if (intent === 'charge') {
            const charged = await requestBillingPayment(token, { planCode, billingCycle, registerOnly: false })
            if (cancelled) return
            if (charged.subscriptionStatus === 'active_paid' || charged.status === 'paid') {
              setResultMode('paid')
              setVerifyState('verified')
              return
            }
            if (charged.needsBillingAuth) {
              setVerifyState('failed')
              return
            }
          }
          if (cancelled) return
          setResultMode(intent === 'charge' ? 'paid' : 'registered')
          setVerifyState('verified')
          return
        }

        const data = await fetchBillingManageSummary(token)
        const status = data.summary?.subscriptionStatus
        if (!isBillingSuccessEntitledStatus(status) && state.mode !== 'paid') {
          if (!cancelled) {
            setVerifyState('failed')
          }
          return
        }
        if (!cancelled) {
          setVerifyState('verified')
          setResultMode(state.mode ?? 'trial')
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
  }, [token, state.trialEndsAt, state.mode, authKey, customerKey, intent, planCode, billingCycle])

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
            <h1>결제가 완료되지 않았습니다.</h1>
            <p className="insurance-billing-plan-note">
              결제 상태가 아직 반영되지 않았습니다. checkout 화면에서 다시 시도해 주세요.
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
  const isPending = resultMode === 'pending'
  const isPaid = resultMode === 'paid'
  const isRegistered = resultMode === 'registered'

  return (
    <main className="insurance-billing-page">
      <div className="insurance-billing-page__shell">
        <div className="insurance-billing-card">
          <h1>
            {isPending
              ? '결제 요청이 접수되었습니다'
              : isPaid
                ? '결제가 완료되었습니다'
                : isRegistered
                  ? '결제수단이 등록되었습니다'
                  : '무료 이용이 시작되었습니다'}
          </h1>
          <p className="insurance-billing-plan-note">
            {isPending
              ? '관리자 승인 후 유료 이용이 시작됩니다. 승인 전까지 CRM 기능은 제한될 수 있습니다.'
              : isPaid
                ? '보험 CRM을 바로 사용할 수 있습니다.'
                : isRegistered
                  ? '등록된 카드로 이후 결제가 진행됩니다.'
                  : '무료 이용 기간 동안 모든 기능을 사용할 수 있습니다.'}
          </p>
          {trialEndsAt ? (
            <div className="insurance-billing-notice">무료 종료일: {trialEndsAt.slice(0, 10)}</div>
          ) : null}
          {!isPending ? (
            <Link to={landing} className="insurance-billing-cta">
              CRM 시작하기
            </Link>
          ) : (
            <Link to="/billing/manage" className="insurance-billing-cta">
              결제 상태 확인
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
