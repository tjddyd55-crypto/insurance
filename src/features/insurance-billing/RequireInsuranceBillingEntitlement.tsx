import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { isBillingUiHiddenForUser } from '../billing/storeReviewBillingAccess'
import {
  buildFeatureAccessContext,
  evaluateRouteFeatureAccess,
} from '../entitlements/featureEntitlementGuard'
import {
  isInsuranceBillingAllowlistedPath,
  isInsuranceBillingEnabledClient,
  isInsuranceBillingEnforceAccessClient,
} from './insuranceBillingConfig'
import {
  hasActiveBillingEntitlementClient,
  resolveBillingAccessRedirectPath,
} from './insuranceBillingEntitlement'
import { useInsuranceBillingSummary } from './hooks/useInsuranceBillingSummary'

/**
 * 보험 CRM 결제단 라우트 가드.
 * feature SSOT 기준으로 유료 기능만 차단하고, 무료 허용 기능은 통과한다.
 */
export function RequireInsuranceBillingEntitlement() {
  const { user } = useAuth()
  const location = useLocation()
  const { summary, checked, fetchFailed } = useInsuranceBillingSummary()

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

  const ctx = buildFeatureAccessContext(user, summary)
  const { featureKey, verdict } = evaluateRouteFeatureAccess(location.pathname, ctx)

  if (featureKey && verdict) {
    if (verdict.allowed || verdict.reason === 'ga_required') {
      return <Outlet />
    }
    if (verdict.reason === 'paid_required') {
      return (
        <Navigate
          to={resolveBillingAccessRedirectPath(location.pathname, {
            subscriptionStatus: summary?.subscriptionStatus,
            status: summary?.status,
            trialEndsAt: summary?.trialEndsAt,
            currentPeriodEnd: summary?.currentPeriodEnd,
            isEntitled: summary?.isEntitled,
          })}
          replace
          state={{ from: location.pathname, reason: 'insurance-billing-required' }}
        />
      )
    }
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
      to={resolveBillingAccessRedirectPath(location.pathname, {
        subscriptionStatus: summary?.subscriptionStatus,
        status: summary?.status,
        trialEndsAt: summary?.trialEndsAt,
        currentPeriodEnd: summary?.currentPeriodEnd,
        isEntitled: summary?.isEntitled,
      })}
      replace
      state={{ from: location.pathname, reason: 'insurance-billing-required' }}
    />
  )
}

export default RequireInsuranceBillingEntitlement
