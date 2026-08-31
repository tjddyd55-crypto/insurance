import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { fetchCheckoutSummary, type CheckoutSummary } from '../insurance-billing/api/insuranceBillingApi'
import {
  INSURANCE_BILLING_BLOCKED_REDIRECT,
  isInsuranceBillingAllowlistedPath,
  isInsuranceBillingEnabledClient,
  isInsuranceBillingEnforceAccessClient,
} from '../insurance-billing/insuranceBillingConfig'
import { hasActiveBillingEntitlementClient } from '../insurance-billing/insuranceBillingEntitlement'
import { isBillingUiHiddenForUser } from '../billing/storeReviewBillingAccess'

/**
 * 보험 CRM 결제단 Phase 1 라우트 가드.
 * INSURANCE_BILLING_ENABLED + ENFORCE_ACCESS 가 켜진 경우에만 차단한다.
 *
 * AppWorkspaceLayout(상단바·메뉴·로그아웃) 바깥이 아니라, 레이아웃 안의 CRM 라우트만 감싼다.
 * /billing/* 는 형제 라우트로 레이아웃을 유지한 채 접근 가능하다.
 */
export function RequireInsuranceBillingEntitlement() {
  const { token, user } = useAuth()
  const location = useLocation()
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [checked, setChecked] = useState(!isInsuranceBillingEnabledClient())

  useEffect(() => {
    if (!isInsuranceBillingEnabledClient() || user?.role !== 'USER') {
      setChecked(true)
      return
    }
    if (!token?.trim()) {
      setChecked(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const nextSummary = await fetchCheckoutSummary(token)
        if (!cancelled) {
          setSummary(nextSummary)
          setFetchFailed(false)
        }
      } catch {
        if (!cancelled) {
          setSummary(null)
          setFetchFailed(true)
        }
      } finally {
        if (!cancelled) {
          setChecked(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  if (!isInsuranceBillingEnabledClient()) {
    return <Outlet />
  }

  if (isBillingUiHiddenForUser(user)) {
    return <Outlet />
  }

  if (!checked) {
    return null
  }

  if (!isInsuranceBillingEnforceAccessClient()) {
    return <Outlet />
  }

  if (user?.role !== 'USER') {
    return <Outlet />
  }

  if (isInsuranceBillingAllowlistedPath(location.pathname)) {
    return <Outlet />
  }

  if (fetchFailed) {
    return <Outlet />
  }

  if (
    hasActiveBillingEntitlementClient({
      subscriptionStatus: summary?.subscriptionStatus,
      status: summary?.status,
      trialEndsAt: summary?.trialEndsAt,
      currentPeriodEnd: summary?.currentPeriodEnd,
      isEntitled: summary?.isEntitled,
    })
  ) {
    return <Outlet />
  }

  return (
    <Navigate
      to={INSURANCE_BILLING_BLOCKED_REDIRECT}
      replace
      state={{ from: location.pathname, reason: 'insurance-billing-required' }}
    />
  )
}

export default RequireInsuranceBillingEntitlement
