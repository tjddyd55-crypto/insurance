import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { isBillingUiHiddenForUser } from '../billing/storeReviewBillingAccess'
import {
  isInsuranceBillingAllowlistedPath,
  isInsuranceBillingEnabledClient,
  isInsuranceBillingEnforceAccessClient,
} from '../insurance-billing/insuranceBillingConfig'
import { useInsuranceBillingSummary } from '../insurance-billing/hooks/useInsuranceBillingSummary'
import {
  buildFeatureAccessContext,
  resolveFeatureEntitlementRedirectPath,
} from './featureEntitlementGuard'

/**
 * 기능 entitlement 기반 라우트 가드 — 결제·GA 두 축을 SSOT 로 평가한다.
 */
export function FeatureEntitlementOutletGuard() {
  const { user } = useAuth()
  const location = useLocation()
  const { summary, checked, fetchFailed } = useInsuranceBillingSummary()

  if (!isInsuranceBillingEnabledClient() || !isInsuranceBillingEnforceAccessClient()) {
    return <Outlet />
  }

  if (isBillingUiHiddenForUser(user)) {
    return <Outlet />
  }

  if (user?.role !== 'USER') {
    return <Outlet />
  }

  if (!checked) {
    return null
  }

  if (isInsuranceBillingAllowlistedPath(location.pathname)) {
    return <Outlet />
  }

  if (fetchFailed) {
    return <Outlet />
  }

  const ctx = buildFeatureAccessContext(user, summary)
  const redirectPath = resolveFeatureEntitlementRedirectPath(location.pathname, ctx, summary)
  if (!redirectPath) {
    return <Outlet />
  }

  return (
    <Navigate
      to={redirectPath}
      replace
      state={{ from: location.pathname, reason: 'feature-entitlement-required' }}
    />
  )
}

export default FeatureEntitlementOutletGuard
