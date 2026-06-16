import { systemQuery } from '../utils/dbSafeQuery.js'
import { normalizePromotionCode } from './promotionCode.js'
import { mapPromotionCodeRow, findPromotionCodeByNormalized } from './promotionService.js'
import { PROMOTION_CODE_TYPES, PROMOTION_DISCOUNT_TYPES, PROMOTION_OWNER_TYPES } from './promotionTypes.js'

function toAdminDto(row) {
  const promo = mapPromotionCodeRow(row)
  return {
    id: promo.id,
    code: promo.code,
    codeNormalized: promo.codeNormalized,
    codeType: promo.codeType,
    discountType: promo.discountType,
    discountAmount: promo.discountAmount,
    discountPercent: promo.discountPercent,
    durationMonths: promo.durationMonths,
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount,
    perAccountLimit: promo.perAccountLimit,
    ownerName: promo.ownerName,
    ownerType: promo.ownerType,
    memo: promo.memo,
    isActive: promo.isActive,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    deletedAt: row.deleted_at ?? null,
    createdBy: row.created_by ?? null,
  }
}

/**
 * @param {Record<string, unknown>} input
 */
function parsePromotionInput(input) {
  const codeRaw = String(input.code ?? input.code_normalized ?? '').trim()
  const codeNormalized = normalizePromotionCode(codeRaw)
  if (!codeNormalized) throw new Error('promotion_code_required')
  if (codeNormalized.length < 3 || codeNormalized.length > 32) {
    throw new Error('promotion_code_length_invalid')
  }

  const codeType = String(input.codeType ?? input.code_type ?? 'discount').trim()
  const discountType = String(input.discountType ?? input.discount_type ?? '').trim()
  const ownerType = String(input.ownerType ?? input.owner_type ?? 'normal').trim()

  if (!PROMOTION_CODE_TYPES.includes(codeType)) throw new Error('promotion_code_type_invalid')
  if (!PROMOTION_DISCOUNT_TYPES.includes(discountType)) throw new Error('promotion_discount_type_invalid')
  if (!PROMOTION_OWNER_TYPES.includes(ownerType)) throw new Error('promotion_owner_type_invalid')

  const discountAmountRaw = input.discountAmount ?? input.discount_amount
  const discountPercentRaw = input.discountPercent ?? input.discount_percent
  const durationMonthsRaw = input.durationMonths ?? input.duration_months
  const maxUsesRaw = input.maxUses ?? input.max_uses
  const perAccountLimitRaw = input.perAccountLimit ?? input.per_account_limit

  const discountAmount =
    discountAmountRaw == null || String(discountAmountRaw).trim() === ''
      ? null
      : Math.round(Number(discountAmountRaw))
  const discountPercent =
    discountPercentRaw == null || String(discountPercentRaw).trim() === ''
      ? null
      : Number(discountPercentRaw)
  const durationMonths =
    durationMonthsRaw == null || String(durationMonthsRaw).trim() === ''
      ? null
      : Math.round(Number(durationMonthsRaw))
  const maxUses =
    maxUsesRaw == null || String(maxUsesRaw).trim() === '' ? null : Math.round(Number(maxUsesRaw))
  const perAccountLimit = Math.max(1, Math.round(Number(perAccountLimitRaw ?? 1) || 1))

  if (discountType.endsWith('_fixed') && (!Number.isFinite(discountAmount) || discountAmount <= 0)) {
    throw new Error('promotion_discount_amount_required')
  }
  if (
    discountType.endsWith('_percent') &&
    (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100)
  ) {
    throw new Error('promotion_discount_percent_required')
  }
  if (discountType.startsWith('recurring_') && (!Number.isFinite(durationMonths) || durationMonths < 1)) {
    throw new Error('promotion_duration_required')
  }
  if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    throw new Error('promotion_max_uses_invalid')
  }

  const startsAtRaw = input.startsAt ?? input.starts_at
  const endsAtRaw = input.endsAt ?? input.ends_at
  const startsAt = startsAtRaw ? new Date(String(startsAtRaw)) : null
  const endsAt = endsAtRaw ? new Date(String(endsAtRaw)) : null
  if (startsAt && Number.isNaN(startsAt.getTime())) throw new Error('promotion_starts_at_invalid')
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error('promotion_ends_at_invalid')
  if (startsAt && endsAt && startsAt > endsAt) throw new Error('promotion_date_range_invalid')

  const ownerNameRaw = input.ownerName ?? input.owner_name
  const memoRaw = input.memo
  const isActiveRaw = input.isActive ?? input.is_active

  return {
    code: codeRaw.trim() || codeNormalized,
    codeNormalized,
    codeType,
    discountType,
    discountAmount: discountType === 'first_month_free' ? null : discountAmount,
    discountPercent: discountType === 'first_month_free' ? null : discountPercent,
    durationMonths: discountType.startsWith('recurring_') ? durationMonths : null,
    startsAt,
    endsAt,
    maxUses,
    perAccountLimit,
    ownerName: ownerNameRaw == null || String(ownerNameRaw).trim() === '' ? null : String(ownerNameRaw).trim(),
    ownerType,
    memo: memoRaw == null || String(memoRaw).trim() === '' ? null : String(memoRaw).trim(),
    isActive: typeof isActiveRaw === 'boolean' ? isActiveRaw : true,
  }
}

/**
 * @param {import('pg').Pool} pool
 */
export async function listPromotionCodesAdmin(pool) {
  const r = await systemQuery(
    pool,
    `
    SELECT *
    FROM promotion_codes
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC, id DESC
    `,
  )
  return r.rows.map(toAdminDto)
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} id
 */
export async function getPromotionCodeAdmin(pool, id) {
  const promoId = Number(id)
  if (!Number.isFinite(promoId) || promoId <= 0) throw new Error('promotion_not_found')
  const r = await systemQuery(
    pool,
    `SELECT * FROM promotion_codes WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [promoId],
  )
  if (r.rowCount === 0) throw new Error('promotion_not_found')
  return toAdminDto(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {Record<string, unknown>} input
 * @param {string | null} createdBy
 */
export async function createPromotionCodeAdmin(pool, input, createdBy) {
  const parsed = parsePromotionInput(input)
  const dup = await findPromotionCodeByNormalized(pool, parsed.codeNormalized)
  if (dup) throw new Error('promotion_code_duplicate')

  const r = await systemQuery(
    pool,
    `
    INSERT INTO promotion_codes (
      code, code_normalized, code_type, discount_type,
      discount_amount, discount_percent, duration_months,
      starts_at, ends_at, max_uses, per_account_limit,
      owner_name, owner_type, memo, is_active, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING *
    `,
    [
      parsed.code,
      parsed.codeNormalized,
      parsed.codeType,
      parsed.discountType,
      parsed.discountAmount,
      parsed.discountPercent,
      parsed.durationMonths,
      parsed.startsAt,
      parsed.endsAt,
      parsed.maxUses,
      parsed.perAccountLimit,
      parsed.ownerName,
      parsed.ownerType,
      parsed.memo,
      parsed.isActive,
      createdBy,
    ],
  )
  return toAdminDto(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} id
 * @param {Record<string, unknown>} input
 */
export async function updatePromotionCodeAdmin(pool, id, input) {
  const promoId = Number(id)
  if (!Number.isFinite(promoId) || promoId <= 0) throw new Error('promotion_not_found')
  const existing = await getPromotionCodeAdmin(pool, promoId)

  const codeRaw = input.code ?? input.code_normalized
  const nextCodeNormalized =
    codeRaw != null && String(codeRaw).trim() !== ''
      ? normalizePromotionCode(String(codeRaw))
      : existing.codeNormalized
  if (!nextCodeNormalized) throw new Error('promotion_code_required')

  if (nextCodeNormalized !== existing.codeNormalized) {
    const dup = await findPromotionCodeByNormalized(pool, nextCodeNormalized)
    if (dup && dup.id !== promoId) throw new Error('promotion_code_duplicate')
  }

  const merged = {
    code: codeRaw != null ? String(codeRaw).trim() || nextCodeNormalized : existing.code,
    code_normalized: nextCodeNormalized,
    codeType: input.codeType ?? input.code_type ?? existing.codeType,
    discountType: input.discountType ?? input.discount_type ?? existing.discountType,
    discountAmount: input.discountAmount ?? input.discount_amount ?? existing.discountAmount,
    discountPercent: input.discountPercent ?? input.discount_percent ?? existing.discountPercent,
    durationMonths: input.durationMonths ?? input.duration_months ?? existing.durationMonths,
    startsAt: input.startsAt ?? input.starts_at ?? existing.startsAt,
    endsAt: input.endsAt ?? input.ends_at ?? existing.endsAt,
    maxUses: input.maxUses ?? input.max_uses ?? existing.maxUses,
    perAccountLimit: input.perAccountLimit ?? input.per_account_limit ?? existing.perAccountLimit,
    ownerName: input.ownerName ?? input.owner_name ?? existing.ownerName,
    ownerType: input.ownerType ?? input.owner_type ?? existing.ownerType,
    memo: input.memo ?? existing.memo,
    isActive: input.isActive ?? input.is_active ?? existing.isActive,
  }

  const parsed = parsePromotionInput(merged)

  const r = await systemQuery(
    pool,
    `
    UPDATE promotion_codes
    SET
      code = $2,
      code_normalized = $3,
      code_type = $4,
      discount_type = $5,
      discount_amount = $6,
      discount_percent = $7,
      duration_months = $8,
      starts_at = $9,
      ends_at = $10,
      max_uses = $11,
      per_account_limit = $12,
      owner_name = $13,
      owner_type = $14,
      memo = $15,
      is_active = $16,
      updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      promoId,
      parsed.code,
      parsed.codeNormalized,
      parsed.codeType,
      parsed.discountType,
      parsed.discountAmount,
      parsed.discountPercent,
      parsed.durationMonths,
      parsed.startsAt,
      parsed.endsAt,
      parsed.maxUses,
      parsed.perAccountLimit,
      parsed.ownerName,
      parsed.ownerType,
      parsed.memo,
      parsed.isActive,
    ],
  )
  if (r.rowCount === 0) throw new Error('promotion_not_found')
  return toAdminDto(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} id
 */
export async function disablePromotionCodeAdmin(pool, id) {
  const promoId = Number(id)
  if (!Number.isFinite(promoId) || promoId <= 0) throw new Error('promotion_not_found')
  const r = await systemQuery(
    pool,
    `
    UPDATE promotion_codes
    SET is_active = false, updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [promoId],
  )
  if (r.rowCount === 0) throw new Error('promotion_not_found')
  return toAdminDto(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} id
 */
export async function getPromotionCodeStatsAdmin(pool, id) {
  const promo = await getPromotionCodeAdmin(pool, id)

  const accountsR = await systemQuery(
    pool,
    `
    SELECT COUNT(1)::int AS cnt
    FROM promotion_code_accounts
    WHERE promotion_code_id = $1
    `,
    [promo.id],
  )
  const redemptionR = await systemQuery(
    pool,
    `
    SELECT
      COUNT(1)::int AS redemption_count,
      COALESCE(SUM(discount_amount), 0)::int AS total_discount_amount,
      COALESCE(SUM(final_amount), 0)::int AS total_final_amount
    FROM promotion_code_redemptions
    WHERE promotion_code_id = $1
    `,
    [promo.id],
  )
  const recentR = await systemQuery(
    pool,
    `
    SELECT
      pcr.id,
      pcr.user_id,
      u.name AS user_name,
      pcr.invoice_id,
      pcr.discount_amount,
      pcr.final_amount,
      pcr.applied_month_index,
      pcr.created_at
    FROM promotion_code_redemptions pcr
    LEFT JOIN users u ON u.id = pcr.user_id
    WHERE pcr.promotion_code_id = $1
    ORDER BY pcr.created_at DESC
    LIMIT 20
    `,
    [promo.id],
  )

  const agg = redemptionR.rows[0] ?? {}
  return {
    promotion: promo,
    accountCount: Number(accountsR.rows[0]?.cnt ?? 0),
    redemptionCount: Number(agg.redemption_count ?? 0),
    totalDiscountAmount: Number(agg.total_discount_amount ?? 0),
    totalFinalAmount: Number(agg.total_final_amount ?? 0),
    recentRedemptions: recentR.rows.map((row) => ({
      id: Number(row.id),
      userId: String(row.user_id ?? ''),
      userName: row.user_name == null ? null : String(row.user_name),
      invoiceId: row.invoice_id == null ? null : Number(row.invoice_id),
      discountAmount: Number(row.discount_amount ?? 0),
      finalAmount: Number(row.final_amount ?? 0),
      appliedMonthIndex: Number(row.applied_month_index ?? 1),
      createdAt: row.created_at ?? null,
    })),
  }
}
