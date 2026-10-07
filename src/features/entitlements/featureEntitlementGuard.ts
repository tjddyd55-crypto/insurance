import type { CheckoutSummary } from '../insurance-billing/api/insuranceBillingApi'
import {
  isInsuranceBillingEnforceAccessClient,
  isInsuranceBillingEnabledClient,
} from '../insurance-billing/insuranceBillingConfig'
import {
  hasActiveBillingEntitlementClient,
  resolveBillingAccessRedirectPath,
} from '../insurance-billing/insuranceBillingEntitlement'
import { toPublicAccountRestrictedPath } from '../auth/publicAccountRestrictedRoutes'
import type { GaTenantDashboardMenuEntry } from '../dashboard/gaTenantMenu'
import {
  evaluateFeatureAccess,
  isGaMemberUser,
  type FeatureAccessContext,
  type FeatureKey,
} from './featureEntitlementPolicy'
import { resolveFeatureKeyFromPath } from './featureRoutePolicy'

type UserLike = {
  role?: string | null
  gaCode?: string | null
  gaName?: string | null
  subscription?: {
    plan?: string | null
    effectiveStatus?: string | null
  } | null
}

export function resolveHasActivePaidAccess(
  user: UserLike | null | undefined,
  billingSummary?: CheckoutSummary | null,
): boolean {
  if (!isInsuranceBillingEnabledClient() || !isInsuranceBillingEnforceAccessClient()) {
    return true
  }
  if (user?.role !== 'USER') {
    return true
  }
  if (billingSummary) {
    return hasActiveBillingEntitlementClient({
      subscriptionStatus: billingSummary.subscriptionStatus,
      status: billingSummary.status,
      trialEndsAt: billingSummary.trialEndsAt,
      currentPeriodEnd: billingSummary.currentPeriodEnd,
      isEntitled: billingSummary.isEntitled,
    })
  }
  const plan = String(user?.subscription?.plan ?? '').trim().toUpperCase()
  const effective = String(user?.subscription?.effectiveStatus ?? '').trim().toUpperCase()
  if (effective === 'ACTIVE' && (plan === 'TRIAL' || plan === 'PAID')) {
    return true
  }
  return false
}

export function buildFeatureAccessContext(
  user: UserLike | null | undefined,
  billingSummary?: CheckoutSummary | null,
): FeatureAccessContext {
  return {
    hasActivePaidAccess: resolveHasActivePaidAccess(user, billingSummary),
    isGaMember: isGaMemberUser(user),
  }
}

export function evaluateRouteFeatureAccess(
  pathname: string,
  ctx: FeatureAccessContext,
  options?: { newsletterBoardScope?: string | null },
) {
  const featureKey = resolveFeatureKeyFromPath(pathname, options)
  if (!featureKey) {
    return { featureKey: null, verdict: null }
  }
  return {
    featureKey,
    verdict: evaluateFeatureAccess(featureKey as FeatureKey, ctx),
  }
}

export function resolveFeatureEntitlementRedirectPath(
  pathname: string,
  ctx: FeatureAccessContext,
  billingSummary?: CheckoutSummary | null,
  options?: { newsletterBoardScope?: string | null },
): string | null {
  const { verdict } = evaluateRouteFeatureAccess(pathname, ctx, options)
  if (!verdict || verdict.allowed) {
    return null
  }
  if (verdict.reason === 'paid_required') {
    return resolveBillingAccessRedirectPath(pathname, {
      subscriptionStatus: billingSummary?.subscriptionStatus,
      status: billingSummary?.status,
      trialEndsAt: billingSummary?.trialEndsAt,
      currentPeriodEnd: billingSummary?.currentPeriodEnd,
      isEntitled: billingSummary?.isEntitled,
    })
  }
  if (verdict.reason === 'ga_required') {
    return toPublicAccountRestrictedPath(pathname)
  }
  return null
}

type EntitlementMenuLink = Extract<GaTenantDashboardMenuEntry, { type: 'link' }>

export function resolveEntitlementMenuNavigationPath(
  item: EntitlementMenuLink,
  billingSummary?: CheckoutSummary | null,
): string {
  if (!item.entitlementBlocked) {
    return item.path
  }
  if (item.entitlementReason === 'paid_required') {
    return resolveBillingAccessRedirectPath(item.path, {
      subscriptionStatus: billingSummary?.subscriptionStatus,
      status: billingSummary?.status,
      trialEndsAt: billingSummary?.trialEndsAt,
      currentPeriodEnd: billingSummary?.currentPeriodEnd,
      isEntitled: billingSummary?.isEntitled,
    })
  }
  if (item.entitlementReason === 'ga_required') {
    return toPublicAccountRestrictedPath(item.path)
  }
  return item.path
}
