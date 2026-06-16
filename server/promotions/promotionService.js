import { systemQuery } from '../utils/dbSafeQuery.js'
import { normalizePromotionCode } from './promotionCode.js'
import { PROMOTION_DISCOUNT_TYPES, PROMOTION_CODE_TYPES, PROMOTION_OWNER_TYPES } from './promotionTypes.js'

/**
 * @typedef {{
 *  id: number;
 *  code: string;
 *  codeNormalized: string;
 *  codeType: typeof PROMOTION_CODE_TYPES[number];
 *  discountType: typeof PROMOTION_DISCOUNT_TYPES[number];
 *  discountAmount: number | null;
 *  discountPercent: number | null;
 *  durationMonths: number | null;
 *  startsAt: Date | null;
 *  endsAt: Date | null;
 *  maxUses: number | null;
 *  usedCount: number;
 *  perAccountLimit: number;
 *  ownerName: string | null;
 *  ownerType: typeof PROMOTION_OWNER_TYPES[number];
 *  memo: string | null;
 *  isActive: boolean;
 * }} PromotionCodeRow
 */

export function mapPromotionCodeRow(row) {
  return {
    id: Number(row.id),
    code: String(row.code ?? ''),
    codeNormalized: String(row.code_normalized ?? ''),
    codeType: String(row.code_type ?? 'discount'),
    discountType: String(row.discount_type ?? ''),
    discountAmount: row.discount_amount == null ? null : Number(row.discount_amount),
    discountPercent: row.discount_percent == null ? null : Number(row.discount_percent),
    durationMonths: row.duration_months == null ? null : Number(row.duration_months),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    maxUses: row.max_uses == null ? null : Number(row.max_uses),
    usedCount: Number(row.used_count ?? 0),
    perAccountLimit: Math.max(1, Number(row.per_account_limit ?? 1) || 1),
    ownerName: row.owner_name == null ? null : String(row.owner_name),
    ownerType: String(row.owner_type ?? 'normal'),
    memo: row.memo == null ? null : String(row.memo),
    isActive: Boolean(row.is_active),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} codeNorm
 * @returns {Promise<PromotionCodeRow | null>}
 */
export async function findPromotionCodeByNormalized(executor, codeNorm) {
  const c = normalizePromotionCode(codeNorm)
  if (!c) return null
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM promotion_codes
    WHERE code_normalized = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [c],
  )
  if (r.rowCount === 0) return null
  return mapPromotionCodeRow(r.rows[0])
}

/**
 * @param {PromotionCodeRow} promo
 * @param {Date} now
 * @returns {{ ok: true } | { ok: false; message: string; reason: string }}
 */
function validatePromotionCodeWindow(promo, now) {
  if (!promo.isActive) return { ok: false, reason: 'inactive', message: '사용할 수 없는 코드입니다.' }
  if (promo.startsAt && now < new Date(promo.startsAt)) {
    return { ok: false, reason: 'not_started', message: '아직 사용할 수 없는 코드입니다.' }
  }
  if (promo.endsAt && now > new Date(promo.endsAt)) {
    return { ok: false, reason: 'expired', message: '만료된 코드입니다.' }
  }
  return { ok: true }
}

/**
 * @param {PromotionCodeRow} promo
 * @returns {{ ok: true } | { ok: false; message: string; reason: string }}
 */
function validatePromotionDiscountFields(promo) {
  if (!PROMOTION_DISCOUNT_TYPES.includes(promo.discountType)) {
    return { ok: false, reason: 'discount_type_invalid', message: '사용할 수 없는 코드입니다.' }
  }
  if (!PROMOTION_CODE_TYPES.includes(promo.codeType)) {
    return { ok: false, reason: 'code_type_invalid', message: '사용할 수 없는 코드입니다.' }
  }
  if (!PROMOTION_OWNER_TYPES.includes(promo.ownerType)) {
    return { ok: false, reason: 'owner_type_invalid', message: '사용할 수 없는 코드입니다.' }
  }
  if (promo.discountType.endsWith('_fixed')) {
    if (!Number.isFinite(promo.discountAmount) || promo.discountAmount == null || promo.discountAmount <= 0) {
      return { ok: false, reason: 'discount_amount_required', message: '사용할 수 없는 코드입니다.' }
    }
  }
  if (promo.discountType.endsWith('_percent')) {
    if (
      !Number.isFinite(promo.discountPercent) ||
      promo.discountPercent == null ||
      promo.discountPercent <= 0 ||
      promo.discountPercent > 100
    ) {
      return { ok: false, reason: 'discount_percent_required', message: '사용할 수 없는 코드입니다.' }
    }
  }
  if (promo.discountType === 'first_month_free') {
    // amount/percent 미사용
    return { ok: true }
  }
  // duration 정책: recurring_* 는 durationMonths 필요(범위에서 평생 할인 제외)
  if (promo.discountType.startsWith('recurring_')) {
    if (!Number.isFinite(promo.durationMonths) || promo.durationMonths == null || promo.durationMonths < 1) {
      return { ok: false, reason: 'duration_required', message: '사용할 수 없는 코드입니다.' }
    }
  }
  return { ok: true }
}

/**
 * 프로모션 코드 "검증"(적용 전). 기존 legacy referral fallback 은 별도 wrapper 에서 수행한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} codeRaw
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<
 *  | { ok: true; promo: PromotionCodeRow }
 *  | { ok: false; message: string; reason: string }
 * >}
 */
export async function validatePromotionCode(executor, codeRaw, opts = {}) {
  const codeNormalized = normalizePromotionCode(codeRaw)
  if (!codeNormalized) return { ok: true, promo: null }
  const promo = await findPromotionCodeByNormalized(executor, codeNormalized)
  if (!promo) return { ok: false, reason: 'not_found', message: '존재하지 않는 코드입니다.' }

  const now = opts.now ?? new Date()
  const windowOk = validatePromotionCodeWindow(promo, now)
  if (!windowOk.ok) return windowOk

  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, reason: 'max_uses', message: '사용 횟수가 모두 소진된 코드입니다.' }
  }
  const fieldsOk = validatePromotionDiscountFields(promo)
  if (!fieldsOk.ok) return fieldsOk
  return { ok: true, promo }
}

/**
 * user 1명당 1개 코드 정책: promotion_code_accounts.user_id PK.
 *
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; promo: PromotionCodeRow }} input
 */
export async function applyPromotionCodeToAccount(client, input) {
  const userId = String(input.userId ?? '').trim()
  const promo = input.promo
  if (!userId || !promo?.id) throw new Error('promotion_apply_invalid_input')

  const dup = await systemQuery(client, `SELECT 1 FROM promotion_code_accounts WHERE user_id = $1 LIMIT 1`, [userId])
  if (dup.rowCount > 0) {
    throw new Error('promotion_already_applied')
  }

  // max_uses / used_count 를 원자적으로 증가시키며 확보한다.
  const bump = await systemQuery(
    client,
    `
    UPDATE promotion_codes
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
      AND is_active = true
      AND (max_uses IS NULL OR used_count < max_uses)
    RETURNING used_count
    `,
    [promo.id],
  )
  if (bump.rowCount === 0) {
    throw new Error('promotion_max_uses')
  }

  await systemQuery(
    client,
    `
    INSERT INTO promotion_code_accounts (user_id, promotion_code_id, code_normalized)
    VALUES ($1, $2, $3)
    `,
    [userId, promo.id, promo.codeNormalized],
  )
}

/**
 * 현재 user에 적용된 프로모션 코드를 가져온다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @returns {Promise<PromotionCodeRow | null>}
 */
export async function getAppliedPromotionForUser(executor, userId) {
  const uid = String(userId ?? '').trim()
  if (!uid) return null
  const r = await systemQuery(
    executor,
    `
    SELECT pc.*
    FROM promotion_code_accounts pca
    INNER JOIN promotion_codes pc ON pc.id = pca.promotion_code_id
    WHERE pca.user_id = $1
      AND pc.deleted_at IS NULL
    LIMIT 1
    `,
    [uid],
  )
  if (r.rowCount === 0) return null
  return mapPromotionCodeRow(r.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @returns {Promise<number>} paid invoice count
 */
export async function countPaidInvoices(executor, userId) {
  const uid = String(userId ?? '').trim()
  if (!uid) return 0
  const r = await systemQuery(
    executor,
    `
    SELECT COUNT(1)::int AS cnt
    FROM payment_invoices
    WHERE user_id = $1 AND status = 'paid'
    `,
    [uid],
  )
  return Number(r.rows[0]?.cnt ?? 0) || 0
}

/**
 * invoice 생성 시점에 적용될 프로모션 할인(공급가 기준)을 계산한다.
 *
 * @param {PromotionCodeRow} promo
 * @param {{ baseSupplyAmount: number; monthIndex: number }} ctx
 * @returns {{ promotionDiscountSupplyAmount: number; applicable: boolean }}
 */
export function calculatePromotionDiscountForMonth(promo, ctx) {
  const base = Math.max(0, Math.round(Number(ctx.baseSupplyAmount) || 0))
  const monthIndex = Math.max(1, Math.round(Number(ctx.monthIndex) || 1))
  if (!promo || base <= 0) return { promotionDiscountSupplyAmount: 0, applicable: false }

  const withinDuration =
    promo.durationMonths == null ? true : monthIndex >= 1 && monthIndex <= Math.max(0, promo.durationMonths)
  const isFirstMonth = monthIndex === 1

  let applicable = false
  let discount = 0

  switch (promo.discountType) {
    case 'first_month_fixed':
      applicable = isFirstMonth
      discount = applicable ? Math.round(Number(promo.discountAmount ?? 0) || 0) : 0
      break
    case 'first_month_percent':
      applicable = isFirstMonth
      discount = applicable ? Math.round((base * (Number(promo.discountPercent ?? 0) || 0)) / 100) : 0
      break
    case 'first_month_free':
      applicable = isFirstMonth
      discount = applicable ? base : 0
      break
    case 'recurring_fixed':
      applicable = withinDuration
      discount = applicable ? Math.round(Number(promo.discountAmount ?? 0) || 0) : 0
      break
    case 'recurring_percent':
      applicable = withinDuration
      discount = applicable ? Math.round((base * (Number(promo.discountPercent ?? 0) || 0)) / 100) : 0
      break
    default:
      applicable = false
      discount = 0
  }

  const capped = Math.min(Math.max(discount, 0), base)
  return { promotionDiscountSupplyAmount: capped, applicable: applicable && capped > 0 }
}

