import {
  isInsuranceBillingEnabledClient,
  isInsuranceBillingEntitledStatus,
} from './insuranceBillingConfig'

/**
 * 결제단 활성화 시 로그인/가입 후 랜딩 경로 보정.
 * entitled 상태면 기존 CRM 랜딩, 아니면 checkout 또는 required 로 유도.
 *
 * 주의: 사용자가 직접 /billing/checkout 에 접근한 경우는 BillingCheckoutPage 가 처리한다.
 * 이 함수는 로그인·회원가입 직후 자동 이동에만 사용한다.
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

/**
 * 내정보관리 → 결제 관리 진입 경로.
 * credential 유무로 checkout/manage 분기. review 계정 예외 없음.
 */
export function resolveInsuranceBillingProfileEntryPath(options: {
  hasBillingKey: boolean
}): '/billing/checkout' | '/billing/manage' {
  return options.hasBillingKey ? '/billing/manage' : '/billing/checkout'
}
