import { systemQuery } from '../utils/dbSafeQuery.js'

export const PROMOTION_ALREADY_USED_ERROR_CODE = 'PROMOTION_ALREADY_USED'

/**
 * 보험 CRM 결제단 프로모션: 계정당 1회만 사용 가능 (코드 종류 무관).
 * 추천인 코드(billing_referrals)와는 별개로 검사한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function assertUserBillingPromotionNotAlreadyUsed(executor, userId) {
  const uid = String(userId ?? '').trim()
  if (!uid) {
    return
  }

  const redemptionR = await systemQuery(
    executor,
    `
    SELECT COUNT(*)::int AS count
    FROM billing_promotion_redemptions
    WHERE user_id = $1
    `,
    [uid],
  )
  if (Number(redemptionR.rows[0]?.count ?? 0) > 0) {
    throw new Error('promotion_already_used')
  }

  const subR = await systemQuery(
    executor,
    `
    SELECT 1
    FROM billing_subscriptions
    WHERE user_id = $1
      AND promotion_code_id IS NOT NULL
    LIMIT 1
    `,
    [uid],
  )
  if (subR.rowCount > 0) {
    throw new Error('promotion_already_used')
  }
}
