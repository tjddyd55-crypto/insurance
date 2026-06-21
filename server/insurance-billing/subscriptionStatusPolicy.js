/**
 * billing_subscriptions.status — DB CHECK 목록 + entitlement 해석 SSOT.
 * initDb CHECK constraint와 API/라우트 entitlement가 동일 목록을 참조한다.
 */

/** PostgreSQL CHECK (NOT VALID) — legacy + Phase1 전체 허용 */
export const BILLING_SUBSCRIPTION_STATUS_CHECK_VALUES = Object.freeze([
  'none',
  'pending_payment',
  'trialing',
  'active_paid',
  'active_manual',
  'legacy_active',
  'past_due',
  'expired',
  'blocked',
  'canceled',
  'cancelled',
  'active',
  'inactive',
  'pending',
  'trial',
  'free',
  'paid',
])

/** CRM 접근 허용 status (legacy active/free/paid 포함) */
export const INSURANCE_BILLING_ENTITLED_STATUSES = Object.freeze([
  'trialing',
  'active_paid',
  'active_manual',
  'legacy_active',
  'trial',
  'active',
  'paid',
  'free',
])

/** CRM 접근 차단 status */
export const INSURANCE_BILLING_BLOCKED_STATUSES = Object.freeze([
  'pending_payment',
  'pending',
  'past_due',
  'expired',
  'blocked',
  'canceled',
  'cancelled',
  'inactive',
  'none',
])

/**
 * @param {string | null | undefined} status
 */
export function isInsuranceBillingEntitledStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return INSURANCE_BILLING_ENTITLED_STATUSES.includes(normalized)
}

/**
 * initDb — NOT VALID CHECK constraint SQL fragment
 */
export function buildBillingSubscriptionStatusCheckConstraintSql() {
  const statusSql = BILLING_SUBSCRIPTION_STATUS_CHECK_VALUES.map(
    (s) => `'${String(s).replace(/'/g, "''")}'`,
  ).join(', ')
  return `CHECK (status IN (${statusSql})) NOT VALID`
}
