import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  approveInsurancePaymentAdmin,
  cancelInsurancePaymentAdmin,
} from './subscriptionLifecycle.js'

const VALID_STATUSES = new Set(['pending', 'paid', 'canceled', 'failed', 'all'])

/**
 * @param {object} row
 */
function mapPaymentAdminRow(row) {
  return {
    paymentId: String(row.payment_id),
    userId: String(row.user_id),
    userName: String(row.user_name ?? '').trim() || String(row.username ?? ''),
    username: String(row.username ?? ''),
    tenantId: row.tenant_id == null ? null : Number(row.tenant_id),
    tenantName: row.tenant_name ? String(row.tenant_name) : null,
    subscriptionId: row.subscription_id == null ? null : String(row.subscription_id),
    planName: String(row.plan_name ?? row.plan_code ?? ''),
    planCode: row.plan_code ? String(row.plan_code) : null,
    billingCycle: String(row.billing_cycle ?? 'monthly'),
    amount: Number(row.amount ?? 0),
    vatAmount: Number(row.vat_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    status: String(row.status ?? ''),
    provider: String(row.provider ?? ''),
    promotionCode: row.promotion_code ? String(row.promotion_code) : null,
    referralCode: row.referral_code ? String(row.referral_code) : null,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? null,
    canceledAt: row.canceled_at ?? null,
    cancelReason: row.cancel_reason ? String(row.cancel_reason) : null,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ status?: string; page?: number; limit?: number; userId?: string; tenantId?: number | string }} query
 */
export async function listInsuranceBillingPaymentsAdmin(executor, query = {}) {
  const status = String(query.status ?? 'all').trim().toLowerCase()
  if (!VALID_STATUSES.has(status)) {
    throw new Error('invalid_status_filter')
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const conditions = ['1=1']
  const params = []
  let paramIndex = 1

  if (status !== 'all') {
    conditions.push(`bp.status = $${paramIndex++}`)
    params.push(status)
  }

  const userId = String(query.userId ?? '').trim()
  if (userId) {
    conditions.push(`bp.user_id = $${paramIndex++}`)
    params.push(userId)
  }

  const tenantId = Number(query.tenantId)
  if (Number.isFinite(tenantId) && tenantId > 0) {
    conditions.push(`bp.tenant_id = $${paramIndex++}`)
    params.push(tenantId)
  }

  const whereSql = conditions.join(' AND ')

  const countR = await systemQuery(
    executor,
    `
    SELECT COUNT(*)::int AS count
    FROM billing_payments bp
    WHERE ${whereSql}
    `,
    params,
  )

  const listR = await systemQuery(
    executor,
    `
    SELECT
      bp.id AS payment_id,
      bp.user_id,
      COALESCE(NULLIF(TRIM(u.display_name), ''), u.username) AS user_name,
      u.username,
      bp.tenant_id,
      gc.name AS tenant_name,
      bp.subscription_id,
      COALESCE(bp.plan_code, bs.plan_code) AS plan_code,
      COALESCE(pl.name, bp.plan_code, bs.plan_code) AS plan_name,
      COALESCE(bp.billing_cycle, bs.billing_cycle, 'monthly') AS billing_cycle,
      bp.amount,
      bp.vat_amount,
      bp.total_amount,
      bp.status,
      bp.provider,
      bp.promotion_code,
      bp.referral_code,
      bp.created_at,
      bp.paid_at,
      bp.canceled_at,
      bp.cancel_reason
    FROM billing_payments bp
    JOIN users u ON u.id = bp.user_id
    LEFT JOIN billing_subscriptions bs ON bs.id = bp.subscription_id
    LEFT JOIN ga_companies gc ON gc.id = u.ga_id
    LEFT JOIN billing_plans pl ON pl.code = COALESCE(bp.plan_code, bs.plan_code)
    WHERE ${whereSql}
    ORDER BY bp.created_at DESC, bp.id DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...params, limit, offset],
  )

  return {
    items: listR.rows.map(mapPaymentAdminRow),
    page,
    limit,
    total: Number(countR.rows[0]?.count ?? 0),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number | string} paymentId
 */
export async function getInsuranceBillingPaymentAdmin(executor, paymentId) {
  const id = Number(paymentId)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('invalid_payment_id')
  }

  const r = await systemQuery(
    executor,
    `
    SELECT
      bp.id AS payment_id,
      bp.user_id,
      COALESCE(NULLIF(TRIM(u.display_name), ''), u.username) AS user_name,
      u.username,
      bp.tenant_id,
      gc.name AS tenant_name,
      bp.subscription_id,
      COALESCE(bp.plan_code, bs.plan_code) AS plan_code,
      COALESCE(pl.name, bp.plan_code, bs.plan_code) AS plan_name,
      COALESCE(bp.billing_cycle, bs.billing_cycle, 'monthly') AS billing_cycle,
      bp.amount,
      bp.vat_amount,
      bp.total_amount,
      bp.status,
      bp.provider,
      bp.promotion_code,
      bp.referral_code,
      bp.created_at,
      bp.paid_at,
      bp.canceled_at,
      bp.cancel_reason
    FROM billing_payments bp
    JOIN users u ON u.id = bp.user_id
    LEFT JOIN billing_subscriptions bs ON bs.id = bp.subscription_id
    LEFT JOIN ga_companies gc ON gc.id = u.ga_id
    LEFT JOIN billing_plans pl ON pl.code = COALESCE(bp.plan_code, bs.plan_code)
    WHERE bp.id = $1
    LIMIT 1
    `,
    [id],
  )

  if (!r.rows[0]) {
    throw new Error('payment_not_found')
  }

  return mapPaymentAdminRow(r.rows[0])
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number | string} paymentId
 * @param {string} adminUserId
 */
export async function approveInsuranceBillingPaymentAdmin(client, paymentId, adminUserId) {
  return approveInsurancePaymentAdmin(client, paymentId, adminUserId)
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number | string} paymentId
 * @param {string} adminUserId
 * @param {string | null | undefined} cancelReason
 */
export async function cancelInsuranceBillingPaymentAdmin(client, paymentId, adminUserId, cancelReason) {
  return cancelInsurancePaymentAdmin(client, paymentId, adminUserId, cancelReason)
}
