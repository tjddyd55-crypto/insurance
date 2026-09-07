import type { AuthUser } from '../auth/authApi'
import { resolveAuthLandingPath } from '../auth/landing'
import { isBillingUiHiddenForUser } from '../billing/storeReviewBillingAccess'
import { fetchCheckoutSummary } from './api/insuranceBillingApi'
import { isInsuranceBillingEnabledClient } from './insuranceBillingConfig'
import { hasActiveBillingEntitlementClient } from './insuranceBillingEntitlement'
import { resolveInsuranceBillingAuthPath } from './insuranceBillingLanding'

/**
 * 로그인·가입·루트 진입 시 결제 entitlement를 확인한 뒤 이동 경로를 결정한다.
 * 미결제 USER는 CRM deep link(returnPath)보다 checkout/required를 우선한다.
 */
export async function resolvePostAuthNavigationPath(
  token: string,
  user: AuthUser | null | undefined,
  isMobile: boolean,
  returnPath: string | null = null,
): Promise<string> {
  const defaultPath = resolveAuthLandingPath(isMobile, user?.role)

  if (
    !user ||
    user.role !== 'USER' ||
    !isInsuranceBillingEnabledClient() ||
    isBillingUiHiddenForUser(user) ||
    !token.trim()
  ) {
    return returnPath ?? defaultPath
  }

  try {
    const summary = await fetchCheckoutSummary(token)
    const entitlementInput = {
      subscriptionStatus: summary.subscriptionStatus,
      status: summary.status,
      trialEndsAt: summary.trialEndsAt,
      currentPeriodEnd: summary.currentPeriodEnd,
      isEntitled: summary.isEntitled,
    }

    if (!hasActiveBillingEntitlementClient(entitlementInput)) {
      return resolveInsuranceBillingAuthPath(defaultPath, entitlementInput)
    }

    return returnPath ?? defaultPath
  } catch {
    return returnPath ?? defaultPath
  }
}
