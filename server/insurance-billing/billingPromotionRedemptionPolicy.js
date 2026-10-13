import { systemQuery } from '../utils/dbSafeQuery.js'

export const PROMOTION_ALREADY_USED_ERROR_CODE = 'PROMOTION_ALREADY_USED'

/**
 * 보험 CRM 결제단 프로모션 사용 정책 (2026-10 확정):
 * - 같은 쿠폰(billing_promotion_codes.id)은 계정당 평생 1회만 등록 가능.
 *   예약(아직 시작 전) 상태로 등록된 쿠폰도 "사용"으로 본다 — 등록 시점에 redemption 행이 생긴다.
 * - 서로 다른 쿠폰은 각 쿠폰의 유효기간·총 사용 한도 안에서 언제든 추가 등록 가능.
 *   기간형 쿠폰의 혜택 기간은 기존 혜택/체험/유료 기간 종료 시점 뒤로 이어 붙인다.
 * 추천인 코드(billing_referrals)와는 별개로 검사한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {number | string | null | undefined} promotionCodeId
 */
export async function assertUserBillingPromotionNotAlreadyUsed(executor, userId, promotionCodeId) {
  const uid = String(userId ?? '').trim()
  const codeId = promotionCodeId == null ? '' : String(promotionCodeId).trim()
  if (!uid || !codeId) {
    return
  }

  const redemptionR = await systemQuery(
    executor,
    `
    SELECT 1
    FROM billing_promotion_redemptions
    WHERE user_id = $1
      AND (
        promotion_code_id = $2::bigint
        OR discount_snapshot_json->>'previousSubscriptionPromotionCodeId' = $2::text
      )
    LIMIT 1
    `,
    [uid, codeId],
  )
  if (redemptionR.rowCount > 0) {
    throw new Error('promotion_already_used')
  }

  // redemption 기록 이전에 구독에만 남아 있던 레거시 적용 흔적도 같은 쿠폰이면 사용으로 본다.
  const subR = await systemQuery(
    executor,
    `
    SELECT 1
    FROM billing_subscriptions
    WHERE user_id = $1
      AND promotion_code_id = $2::bigint
    LIMIT 1
    `,
    [uid, codeId],
  )
  if (subR.rowCount > 0) {
    throw new Error('promotion_already_used')
  }
}

/**
 * 같은 사용자의 프로모션 적용을 트랜잭션 단위로 직렬화한다 (BEGIN 이후 호출).
 * 구독 행이 아직 없는 사용자도 막을 수 있도록 advisory xact lock 을 먼저 잡고,
 * 구독 행이 있으면 FOR UPDATE 로 잠근다.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 */
export async function lockUserBillingPromotionScope(client, userId) {
  const uid = String(userId ?? '').trim()
  if (!uid) return
  await systemQuery(client, `SELECT pg_advisory_xact_lock(hashtextextended('billing_promotion:' || $1, 0))`, [uid])
  await systemQuery(client, `SELECT id FROM billing_subscriptions WHERE user_id = $1 FOR UPDATE`, [uid])
}

/**
 * 쿠폰 총 사용 한도를 원자적으로 확보한다. 한도가 찼으면 promotion_max_redemptions.
 *
 * @param {import('pg').PoolClient} client
 * @param {number | string} promotionCodeId
 */
export async function reserveBillingPromotionUsage(client, promotionCodeId) {
  const r = await systemQuery(
    client,
    `
    UPDATE billing_promotion_codes
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = $1
      AND (max_redemptions IS NULL OR used_count < max_redemptions)
    RETURNING used_count
    `,
    [promotionCodeId],
  )
  if (r.rowCount === 0) {
    throw new Error('promotion_max_redemptions')
  }
}

/**
 * 이미 등록된(예약 포함) 기간형 쿠폰 혜택의 가장 늦은 종료 시점.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @returns {Promise<Date | null>}
 */
export async function loadLatestBillingPromotionBenefitEnd(executor, userId) {
  const r = await systemQuery(
    executor,
    `SELECT MAX(free_ends_at) AS max_end FROM billing_promotion_redemptions WHERE user_id = $1`,
    [String(userId ?? '').trim()],
  )
  const v = r.rows[0]?.max_end
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
