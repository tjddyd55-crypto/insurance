import {
  isInsuranceBillingEnabledClient,
  isInsuranceBillingEntitledStatus,
} from './insuranceBillingConfig'

/**
 * 결제단 활성화 시 로그인/가입 후 랜딩 경로 보정.
 * entitled 상태면 기존 CRM 랜딩, 아니면 checkout 또는 required 로 유도.
 */
export function resolveInsuranceBillingAuthPath(
  defaultPath: string,
  subscriptionStatus: string | null | undefined,
): string {
  if (!isInsuranceBillingEnabledClient()) {
    return defaultPath
  }

  const status = String(subscriptionStatus ?? '').trim().toLowerCase()
  if (isInsuranceBillingEntitledStatus(status)) {
    return defaultPath
  }

  if (!status || status === 'pending_payment' || status === 'none') {
    return '/billing/checkout'
  }

  return '/billing/required'
}
