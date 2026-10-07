/** checkout 화면 모드 — subscription status 기반 UI 분기 */
export type BillingCheckoutMode =
  | 'pending_payment'
  | 'trialing'
  | 'active_paid'
  | 'legacy_entitled'
  | 'payment_required'

export function resolveBillingCheckoutMode(status: string | null | undefined): BillingCheckoutMode {
  const normalized = String(status ?? '').trim().toLowerCase()

  if (['expired', 'blocked', 'past_due', 'canceled', 'cancelled', 'inactive'].includes(normalized)) {
    return 'payment_required'
  }
  if (normalized === 'pending_payment' || normalized === 'pending' || normalized === 'none' || !normalized) {
    return 'pending_payment'
  }
  if (normalized === 'trialing' || normalized === 'trial') {
    return 'trialing'
  }
  if (normalized === 'active_paid' || normalized === 'paid') {
    return 'active_paid'
  }
  if (['legacy_active', 'active', 'active_manual', 'free'].includes(normalized)) {
    return 'legacy_entitled'
  }
  return 'pending_payment'
}

export function canApplyPromotionCodeOnCheckout(mode: BillingCheckoutMode): boolean {
  return mode === 'pending_payment' || mode === 'payment_required'
}

export type BillingTestChargeConfig = {
  allowDevTestCharge?: boolean
  mode?: string | null
  provider?: string | null
  enabled?: boolean
} | null | undefined

/**
 * development + Toss TEST(virtual) 전용 QA 버튼.
 * production runtime 은 allowDevTestCharge=false 이므로 mode=virtual 이어도 노출하지 않는다.
 */
export function canRunTestCharge(
  cfg: BillingTestChargeConfig,
  hasBillingKey: boolean,
): boolean {
  return (
    Boolean(cfg?.allowDevTestCharge) &&
    cfg?.mode === 'virtual' &&
    cfg?.provider === 'toss' &&
    Boolean(cfg?.enabled) &&
    hasBillingKey
  )
}
