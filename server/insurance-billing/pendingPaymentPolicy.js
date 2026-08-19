/**
 * billing_payments pending 가드 + stale 정리.
 */

import { systemQuery } from '../utils/dbSafeQuery.js'

/** pending 결제 요청 TTL — 초과 시 canceled(stale) 로 정리 후 새 요청 허용 */
export const BILLING_PENDING_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000

/**
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 */
export async function expireStalePendingInsurancePayments(client, userId) {
  const cutoff = new Date(Date.now() - BILLING_PENDING_PAYMENT_TTL_MS).toISOString()
  await systemQuery(
    client,
    `
    UPDATE billing_payments
    SET
      status = 'canceled',
      canceled_at = NOW(),
      cancel_reason = 'stale_pending_timeout',
      updated_at = NOW()
    WHERE user_id = $1
      AND status = 'pending'
      AND created_at < $2
    `,
    [userId, cutoff],
  )
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 */
export async function assertNoActivePendingInsurancePayment(client, userId) {
  await expireStalePendingInsurancePayments(client, userId)
  const pendingR = await systemQuery(
    client,
    `
    SELECT id FROM billing_payments
    WHERE user_id = $1 AND status = 'pending'
    LIMIT 1
    `,
    [userId],
  )
  if (pendingR.rowCount > 0) {
    throw new Error('payment_already_pending')
  }
}
