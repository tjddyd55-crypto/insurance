import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { isInsuranceBillingEnabledClient } from '../insuranceBillingConfig'
import { fetchBillingManageSummary, type CheckoutSummary } from '../api/insuranceBillingApi'
import { buildBillingStatusBadgeView } from '../billingStatusBadgeUtils'
import { isSubscriptionSubjectRole } from '../../subscription/policy'
import '../billing-status-badge.css'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export default function BillingStatusBadge() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)

  const shouldLoad =
    isInsuranceBillingEnabledClient() &&
    Boolean(token?.trim()) &&
    isSubscriptionSubjectRole(user?.role)

  const load = useCallback(async () => {
    if (!shouldLoad || !token?.trim()) {
      setLoadState('idle')
      setSummary(null)
      return
    }
    setLoadState('loading')
    try {
      const data = await fetchBillingManageSummary(token)
      setSummary(data.summary)
      setLoadState('ready')
    } catch {
      setSummary(null)
      setLoadState('error')
    }
  }, [shouldLoad, token])

  useEffect(() => {
    void load()
  }, [load])

  if (!shouldLoad) {
    return null
  }

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <span className="billing-status-badge billing-status-badge--muted" aria-live="polite">
        상태 확인 중
      </span>
    )
  }

  if (loadState === 'error') {
    return null
  }

  const view = buildBillingStatusBadgeView(summary)
  if (!view) {
    return null
  }

  return (
    <button
      type="button"
      className={`billing-status-badge billing-status-badge--${view.tone}`}
      onClick={() => navigate(view.href)}
      aria-label={`결제 상태: ${view.label}. 클릭하면 결제 정보로 이동합니다.`}
    >
      {view.label}
    </button>
  )
}
