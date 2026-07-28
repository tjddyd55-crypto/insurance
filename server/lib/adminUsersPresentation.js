import {
  buildAdminUserSubscriptionListLabel,
  resolveSubscriptionStatusLabel,
  resolveSubscriptionUntilIso,
  toIsoStringOrNull,
} from './billingSubscriptionPresentation.js'

/**
 * @param {string | null | undefined} raw
 */
export function parseAdminUserSubscriptionFilter(raw) {
  const normalized = String(raw ?? '').trim().toLowerCase()
  if (!normalized) {
    return null
  }
  const allowed = new Set([
    'active_paid',
    'trialing',
    'pending_payment',
    'past_due',
    'expired',
    'canceled',
    'none',
  ])
  return allowed.has(normalized) ? normalized : null
}

/**
 * @param {string | null | undefined} raw
 */
export function parseAdminUserSearchQuery(raw) {
  const q = String(raw ?? '').trim()
  return q.length > 0 ? q.slice(0, 100) : null
}

/**
 * @param {string | null | undefined} raw
 * @returns {'yes' | 'no' | null}
 */
export function parseAdminUserHasPhoneFilter(raw) {
  const normalized = String(raw ?? '').trim().toLowerCase()
  if (normalized === 'yes' || normalized === '1' || normalized === 'true') return 'yes'
  if (normalized === 'no' || normalized === '0' || normalized === 'false') return 'no'
  return null
}

/**
 * @param {string | null | undefined} raw
 */
export function parseAdminUserRoleFilter(raw) {
  const role = String(raw ?? '').trim().toUpperCase()
  const allowed = new Set([
    'SUPER_ADMIN',
    'GA_ADMIN',
    'GA_STAFF',
    'USER',
    'INSURER_MANAGER',
    'LOSS_ADJUSTER',
  ])
  return allowed.has(role) ? role : null
}

/**
 * @param {string | null | undefined} raw
 */
export function parseAdminUserStatusFilter(raw) {
  const status = String(raw ?? '').trim().toLowerCase()
  if (status === 'active' || status === 'blocked' || status === 'inactive') return status
  return null
}

/**
 * @param {import('pg').QueryResultRow} row
 * @param {(value: unknown) => string | null} toIso
 */
export function mapAdminUserListRow(row, toIso) {
  const subscriptionStatusRaw = row.subscription_status != null ? String(row.subscription_status).trim().toLowerCase() : ''
  const subscriptionStatus = subscriptionStatusRaw || null
  const trialEndsAt = toIsoStringOrNull(row.trial_ends_at)
  const nextBillingAt = toIsoStringOrNull(row.next_billing_at)
  const currentPeriodEnd = toIsoStringOrNull(row.current_period_end)
  const lastLoginRaw = row.last_login_at ?? row.audit_last_login_at
  const lastLoginAt = lastLoginRaw != null ? toIso(lastLoginRaw) : null
  const subscriptionUntil = resolveSubscriptionUntilIso(
    subscriptionStatus,
    trialEndsAt,
    nextBillingAt,
    currentPeriodEnd,
  )

  const phoneRaw = row.phone_number != null ? String(row.phone_number).trim() : ''
  return {
    id: String(row.id),
    ga_id: row.ga_id,
    display_name: String(row.display_name ?? '').trim(),
    ga_company_name: row.ga_company_name,
    username: row.username,
    phone_number: phoneRaw || null,
    role: row.role,
    status: String(row.status ?? 'active').toLowerCase(),
    created_at: toIso(row.created_at),
    referrer_user_id: row.referrer_user_id != null ? String(row.referrer_user_id) : null,
    referrer_username: row.referrer_username != null ? String(row.referrer_username) : null,
    referrer_display_name:
      row.referrer_display_name != null ? String(row.referrer_display_name).trim() : null,
    referrer_ga_company_name:
      row.referrer_ga_company_name != null ? String(row.referrer_ga_company_name) : null,
    last_login_at: lastLoginAt,
    subscription_status: subscriptionStatus,
    subscription_status_label: subscriptionStatus
      ? resolveSubscriptionStatusLabel(subscriptionStatus)
      : resolveSubscriptionStatusLabel('none'),
    subscription_until: subscriptionUntil ? subscriptionUntil.slice(0, 10) : null,
    subscription_list_label: buildAdminUserSubscriptionListLabel(
      subscriptionStatus,
      trialEndsAt,
      nextBillingAt,
      currentPeriodEnd,
    ),
  }
}
