/**
 * 보험 CRM 결제단 Phase 1 — feature flag / provider SSOT.
 *
 * INSURANCE_BILLING_ENABLED        — 결제단 UI·상태 판단 (기본 false)
 * INSURANCE_BILLING_ENFORCE_ACCESS — CRM API/라우트 차단 (기본 false)
 * INSURANCE_BILLING_PROVIDER       — mock | toss (1차 mock)
 */

import {
  INSURANCE_BILLING_BLOCKED_STATUSES,
  INSURANCE_BILLING_ENTITLED_STATUSES,
  isInsuranceBillingEntitledStatus as isEntitledStatus,
} from './subscriptionStatusPolicy.js'

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

/** @deprecated 이름 호환 — subscriptionStatusPolicy.js 와 동일 */
export const INSURANCE_BILLING_ALLOWED_STATUSES = INSURANCE_BILLING_ENTITLED_STATUSES

export { INSURANCE_BILLING_BLOCKED_STATUSES }

export function isInsuranceBillingEntitledStatus(status) {
  return isEntitledStatus(status)
}
