import { useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { isBillingUiHiddenForUser } from '../billing/storeReviewBillingAccess'
import {
  isInsuranceBillingAllowlistedPath,
  isInsuranceBillingEnabledClient,
  isInsuranceBillingEnforceAccessClient,
} from '../insurance-billing/insuranceBillingConfig'
import { useInsuranceBillingSummary } from '../insurance-billing/hooks/useInsuranceBillingSummary'
import { listVisibleNewsletterBoards } from '../insurer-news/services/insurerNews.service'
import {
  buildFeatureAccessContext,
  resolveFeatureEntitlementRedirectPath,
} from './featureEntitlementGuard'
import { buildNewsletterBoardSlugScopeMap } from './featureRoutePolicy'

/**
 * 기능 entitlement 기반 라우트 가드 — 결제·GA 두 축을 SSOT 로 평가한다.
 */
export function FeatureEntitlementOutletGuard() {
  const { user, token } = useAuth()
  const location = useLocation()
  const { summary, checked, fetchFailed } = useInsuranceBillingSummary()
  const [newsletterBoardSlugScopes, setNewsletterBoardSlugScopes] = useState<
    Record<string, string> | null
  >(null)

  useEffect(() => {
    let cancelled = false
    if (!token?.trim() || user?.role !== 'USER') {
      setNewsletterBoardSlugScopes(null)
      return () => {
        cancelled = true
      }
    }

    void listVisibleNewsletterBoards(token)
      .then((boards) => {
        if (cancelled) {
          return
        }
        setNewsletterBoardSlugScopes(buildNewsletterBoardSlugScopeMap(boards))
      })
      .catch(() => {
        if (!cancelled) {
          setNewsletterBoardSlugScopes({})
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  const boardScopeOptions = useMemo(
    () => ({ newsletterBoardSlugScopes }),
    [newsletterBoardSlugScopes],
  )

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

  const normalizedPath = location.pathname.split('?')[0] ?? location.pathname
  const isDynamicBoardPath = normalizedPath.startsWith('/portal/boards/')
  if (isDynamicBoardPath && newsletterBoardSlugScopes === null) {
    return null
  }

  const ctx = buildFeatureAccessContext(user, summary)
  const redirectPath = resolveFeatureEntitlementRedirectPath(
    location.pathname,
    ctx,
    summary,
    boardScopeOptions,
  )
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
