import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const isMobile = useIsMobile()
  const state = (location.state ?? {}) as { mode?: string; trialEndsAt?: string }
  const landing = resolveAuthLandingPath(isMobile, user?.role)
  const [verifyState, setVerifyState] = useState<VerifyState>('loading')
  const [verifiedTrialEndsAt, setVerifiedTrialEndsAt] = useState<string | null>(null)
  const [resultMode, setResultMode] = useState(state.mode ?? '')

  // 마운트 시점에 민감 params를 ref로 스냅샷. useEffect deps에 searchParams를 넣지 않아
  // URL 변경 후에도 effect가 재실행되지 않는다.
  const callbackParamsRef = useRef({
    authKey: String(searchParams.get('authKey') ?? '').trim(),
    customerKey: String(searchParams.get('customerKey') ?? '').trim(),
    intent: String(searchParams.get('intent') ?? 'charge').trim(),
    planCode: String(searchParams.get('planCode') ?? 'insurance_basic').trim(),
    billingCycle: String(searchParams.get('billingCycle') ?? 'monthly').trim(),
  })
  // confirm이 이미 실행됐는지 추적 — 새로고침 후 authKey가 없으면 재실행하지 않음
  const confirmedRef = useRef(false)

  useEffect(() => {
    if (!token?.trim()) {
      setVerifyState('failed')
      return
    }
    // 이미 처리된 경우 (URL replace 후 effect 재실행 방지)
    if (confirmedRef.current) return

    const { authKey, customerKey, intent, planCode, billingCycle } = callbackParamsRef.current

    if (state.mode === 'pending' && !authKey) {
      setVerifyState('verified')
      setResultMode('pending')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        if (authKey && customerKey) {
          confirmedRef.current = true
          // params를 확보한 직후 URL에서 민감값 제거 (페이지 reload 없음)
          navigate('/billing/success?intent=' + encodeURIComponent(intent), { replace: true })

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
    // token과 state.mode만 deps — searchParams 파생값은 ref로 관리하므로 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, state.mode])

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
                  ? '결제수단이 등록되었습니다.'
                  : '무료 이용이 시작되었습니다'}
          </h1>
          <p className="insurance-billing-plan-note">
            {isPending
              ? '관리자 승인 후 유료 이용이 시작됩니다. 승인 전까지 CRM 기능은 제한될 수 있습니다.'
              : isPaid
                ? '보험 CRM을 바로 사용할 수 있습니다.'
                  : isRegistered
                  ? '현재 이용 중인 기간은 그대로 유지됩니다. 이후 결제에 등록된 카드가 사용됩니다.'
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
