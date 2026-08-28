/**
 * 결제 성공 시 amount_off / percent_off / full_discount 쿠폰 소진.
 * free_months 는 apply-promotion 경로에서 이미 소진되므로 여기서 스킵.
 */

import { systemQuery } from '../utils/dbSafeQuery.js'
import { loadPromotionCodeRow } from './promotionService.js'
import { assertUserBillingPromotionNotAlreadyUsed } from './billingPromotionRedemptionPolicy.js'
import { recordBillingEvent } from './subscriptionLifecycle.js'

/**
 * @param {import('pg').PoolClient} client
 * @param {{
 *   userId: string
 *   paymentId: number
 *   promotionCode?: string | null
 *   discountAmount?: number
 *   finalAmount?: number
 *   billingCycle?: string
 * }} params
 */
export async function redeemDiscountPromotionOnPaidPayment(client, params) {
  const userId = String(params.userId ?? '').trim()
  const code = String(params.promotionCode ?? '').trim()
  if (!userId || !code) {
    return { redeemed: false, reason: 'no_promotion' }
  }

  const row = await loadPromotionCodeRow(client, { code })
  if (!row) {
    return { redeemed: false, reason: 'promotion_not_found' }
  }
  const type = String(row.type ?? '').trim()
  if (type === 'free_months') {
    return { redeemed: false, reason: 'free_months_uses_apply_path' }
  }
  if (!['amount_off', 'percent_off', 'full_discount'].includes(type)) {
    return { redeemed: false, reason: 'type_not_discount' }
  }

  // 이미 소진된 사용자면 결제 성공 트랜잭션을 깨지 않도록 skip (이중 소진 방지)
  try {
    await assertUserBillingPromotionNotAlreadyUsed(client, userId)
  } catch {
    return { redeemed: false, reason: 'already_used' }
  }

  const subR = await systemQuery(
    client,
    `SELECT id, tenant_id FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  const sub = subR.rows[0]
  if (!sub) {
    return { redeemed: false, reason: 'subscription_not_found' }
  }

  await systemQuery(
    client,
    `
    INSERT INTO billing_promotion_redemptions (
      promotion_code_id, user_id, tenant_id, subscription_id,
      redeemed_at, free_starts_at, free_ends_at, discount_snapshot_json
    )
    VALUES ($1, $2, $3, $4, NOW(), NULL, NULL, $5::jsonb)
    `,
    [
      row.id,
      userId,
      sub.tenant_id,
      sub.id,
      JSON.stringify({
        type,
        code: row.code,
        paymentId: params.paymentId,
        discountAmount: params.discountAmount ?? null,
        finalAmount: params.finalAmount ?? null,
        billingCycle: params.billingCycle ?? null,
      }),
    ],
  )

  await systemQuery(
    client,
    `UPDATE billing_promotion_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1`,
    [row.id],
  )

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET promotion_code_id = $2, updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, row.id],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'promotion.discount.redeemed',
    payload: {
      code: row.code,
      type,
      paymentId: params.paymentId,
      discountAmount: params.discountAmount ?? null,
    },
  })

  return { redeemed: true, code: row.code, type }
}
