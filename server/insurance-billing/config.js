/**
 * 보험 CRM 결제단 Phase 1 — feature flag / provider SSOT.
 *
 * INSURANCE_BILLING_ENABLED        — 결제단 UI·상태 판단 (기본 false)
 * INSURANCE_BILLING_ENFORCE_ACCESS — CRM API/라우트 차단 (기본 false)
 * INSURANCE_BILLING_PROVIDER       — mock | toss (1차 mock)
 */

export const INSURANCE_BASIC_PLAN_CODE = 'insurance_basic'

export function parseEnvBool(value, defaultValue = false) {
  if (value == null || String(value).trim() === '') {
    return defaultValue
  }
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false
  }
  return defaultValue
}

export function isInsuranceBillingEnabled() {
  return parseEnvBool(process.env.INSURANCE_BILLING_ENABLED, false)
}

export function isInsuranceBillingEnforceAccess() {
  return parseEnvBool(process.env.INSURANCE_BILLING_ENFORCE_ACCESS, false)
}

export function getInsuranceBillingProvider() {
  const raw = String(process.env.INSURANCE_BILLING_PROVIDER ?? 'mock').trim().toLowerCase()
  return raw === 'toss' ? 'toss' : 'mock'
}

/** mock 결제 API 허용 여부 — production 에서는 항상 false */
export function isMockPaymentAllowed() {
  if (getInsuranceBillingProvider() !== 'mock') {
    return false
  }
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv === 'production') {
    return false
  }
  return true
}

/** CRM 접근 허용 subscription status */
export const INSURANCE_BILLING_ALLOWED_STATUSES = Object.freeze([
  'trialing',
  'active_paid',
  'active_manual',
  'legacy_active',
  // 기존 billing_subscriptions 호환
  'trial',
  'active',
])

export const INSURANCE_BILLING_BLOCKED_STATUSES = Object.freeze([
  'pending_payment',
  'expired',
  'blocked',
  'canceled',
  'cancelled',
  'past_due',
  'none',
])
