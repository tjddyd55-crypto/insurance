import {
  isInsuranceBillingEnabledClient,
  isInsuranceBillingEntitledStatus,
} from './insuranceBillingConfig'
import type { BillingEntitlementInput } from './insuranceBillingEntitlement'
import {
  hasActiveBillingEntitlementClient,
  resolveBillingAccessRedirectPath,
} from './insuranceBillingEntitlement'

/**
 * 결제단 활성화 시 로그인/가입 후 랜딩 경로 보정.
 * entitled 상태면 기존 CRM 랜딩, 아니면 checkout 또는 required 로 유도.
 *
 * 주의: 사용자가 직접 /billing/checkout 에 접근한 경우는 BillingCheckoutPage 가 처리한다.
 * 이 함수는 로그인·회원가입 직후 자동 이동에만 사용한다.
 */
export function resolveInsuranceBillingAuthPath(
  defaultPath: string,
  subscriptionStatusOrSummary: string | BillingEntitlementInput | null | undefined,
): string {
  if (!isInsuranceBillingEnabledClient()) {
    return defaultPath
  }

  if (typeof subscriptionStatusOrSummary === 'string') {
    const status = subscriptionStatusOrSummary.trim().toLowerCase()
    if (isInsuranceBillingEntitledStatus(status)) {
      return defaultPath
    }
    if (!status || status === 'pending_payment' || status === 'none') {
      return '/billing/checkout'
    }
    return '/billing/required'
  }

  return resolveBillingAccessRedirectPath(defaultPath, subscriptionStatusOrSummary)
}

/**
 * @deprecated hasActiveBillingEntitlementClient / summary.isEntitled 사용
 */
export function isInsuranceBillingAuthEntitled(
  input: BillingEntitlementInput | null | undefined,
): boolean {
  return hasActiveBillingEntitlementClient(input)
}

/**
 * 내정보관리 → 결제 관리 진입 경로.
 * credential 유무 + entitlement 로 checkout/manage 분기.
 */
export { resolveBillingProfileEntryPath as resolveInsuranceBillingProfileEntryPath } from './insuranceBillingEntitlement'
