import { systemQuery } from '../utils/dbSafeQuery.js'
import { recordBillingEvent } from './subscriptionLifecycle.js'
import { INSURANCE_BASIC_PLAN_CODE } from './config.js'

export const BILLING_PROMOTION_FREE_MONTHS_MIN = 1
export const BILLING_PROMOTION_FREE_MONTHS_MAX = 12

function normalizePromotionCode(raw) {
  return String(raw ?? '').trim().toUpperCase()
}

export const BILLING_PROMOTION_APPLY_SCOPES = Object.freeze(['all', 'ga', 'user', 'test'])

function normalizeApplyScope(raw) {
  const normalized = String(raw ?? 'all').trim().toLowerCase()
  if (BILLING_PROMOTION_APPLY_SCOPES.includes(normalized)) {
    return normalized
  }
  return 'all'
}

function parsePromotionMetaFields(body) {
  const applyScope = normalizeApplyScope(body?.applyScope ?? body?.apply_scope)
  const adminMemoRaw = body?.memo ?? body?.adminMemo ?? body?.admin_memo
  const adminMemo =
    adminMemoRaw == null || String(adminMemoRaw).trim() === '' ? null : String(adminMemoRaw).trim()
  return { applyScope, adminMemo }
}

/**
 * @param {object} body
 */
export function parseCreateBillingPromotionInput(body) {
  const code = normalizePromotionCode(body?.code)
  const name = String(body?.name ?? '').trim()
  const type = String(body?.type ?? '').trim()
  const appliesToProduct = String(body?.appliesToProduct ?? body?.applies_to_product ?? 'insurance').trim()
  const appliesToPlanCode = String(body?.appliesToPlanCode ?? body?.applies_to_plan_code ?? INSURANCE_BASIC_PLAN_CODE).trim()
  const maxRedemptionsRaw = body?.maxRedemptions ?? body?.max_redemptions
  const maxRedemptions =
    maxRedemptionsRaw == null || String(maxRedemptionsRaw).trim() === ''
      ? null
      : Number(maxRedemptionsRaw)
  const { applyScope, adminMemo } = parsePromotionMetaFields(body)

  if (!code) {
    throw new Error('promotion_code_required')
  }
  if (!name) {
    throw new Error('promotion_name_required')
  }
  if (appliesToProduct !== 'insurance') {
    throw new Error('promotion_product_invalid')
  }
  if (maxRedemptions != null && (!Number.isFinite(maxRedemptions) || maxRedemptions < 1)) {
    throw new Error('promotion_max_redemptions_invalid')
  }

  if (type === 'free_months') {
    const freeMonths = Number(body?.freeMonths ?? body?.free_months)
    if (!Number.isFinite(freeMonths) || freeMonths < BILLING_PROMOTION_FREE_MONTHS_MIN) {
      throw new Error('promotion_free_months_required')
    }
    if (freeMonths > BILLING_PROMOTION_FREE_MONTHS_MAX) {
      throw new Error('promotion_free_months_max')
    }
    return {
      code,
      name,
      type: 'free_months',
      freeMonths: Math.floor(freeMonths),
      percentOff: null,
      amountOff: null,
      appliesToProduct,
      appliesToPlanCode,
      maxRedemptions,
      applyScope,
      adminMemo,
    }
  }

  if (type === 'amount_off') {
    const amountOff = Number(body?.amountOff ?? body?.amount_off)
    if (!Number.isFinite(amountOff) || amountOff < 1) {
      throw new Error('promotion_amount_off_required')
    }
    return {
      code,
      name,
      type: 'amount_off',
      freeMonths: null,
      percentOff: null,
      amountOff: Math.floor(amountOff),
      appliesToProduct,
      appliesToPlanCode,
      maxRedemptions,
      applyScope,
      adminMemo,
    }
  }

  if (type === 'percent_off') {
    const percentOff = Number(body?.percentOff ?? body?.percent_off)
    if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
      throw new Error('promotion_percent_off_required')
    }
    return {
      code,
      name,
      type: 'percent_off',
      freeMonths: null,
      percentOff,
      amountOff: null,
      appliesToProduct,
      appliesToPlanCode,
      maxRedemptions,
      applyScope,
      adminMemo,
    }
  }

  throw new Error('promotion_type_invalid')
}

/**
 * @param {object} body
 */
export function parseUpdateBillingPromotionInput(body) {
  const parsed = parseCreateBillingPromotionInput({
    ...body,
    code: body?.code ?? 'PLACEHOLDER-CODE',
  })
  return {
    name: parsed.name,
    type: parsed.type,
    freeMonths: parsed.freeMonths,
    percentOff: parsed.percentOff,
    amountOff: parsed.amountOff,
    appliesToPlanCode: parsed.appliesToPlanCode,
    maxRedemptions: parsed.maxRedemptions,
    applyScope: parsed.applyScope,
    adminMemo: parsed.adminMemo,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ adminUserId: string } & ReturnType<typeof parseCreateBillingPromotionInput>} params
 */
export async function createBillingPromotionCodeAdmin(executor, params) {
  const dup = await systemQuery(
    executor,
    `SELECT id FROM billing_promotion_codes WHERE UPPER(code) = $1 LIMIT 1`,
    [params.code],
  )
  if (dup.rowCount > 0) {
    throw new Error('promotion_code_duplicate')
  }

  const r = await systemQuery(
    executor,
    `
    INSERT INTO billing_promotion_codes (
      code, name, type, free_months, percent_off, amount_off,
      max_redemptions, applies_to_plan_code, applies_to_product, apply_scope, admin_memo,
      is_active, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
    RETURNING *
    `,
    [
      params.code,
      params.name,
      params.type,
      params.freeMonths,
      params.percentOff,
      params.amountOff,
      params.maxRedemptions,
      params.appliesToPlanCode,
      params.appliesToProduct,
      params.applyScope,
      params.adminMemo,
    ],
  )

  const row = r.rows[0]
  await recordBillingEvent(executor, {
    userId: params.adminUserId,
    eventType: 'promotion.admin.created',
    payload: {
      promotionCodeId: Number(row.id),
      code: row.code,
      type: row.type,
      freeMonths: row.free_months,
    },
  })

  return mapBillingPromotionCodeAdminRow(row)
}

/**
 * @param {string | null | undefined} raw
 * @returns {'all' | 'active' | 'inactive' | 'deleted'}
 */
export function normalizePromotionListFilter(raw) {
  const normalized = String(raw ?? 'all').trim().toLowerCase()
  if (normalized === 'active' || normalized === 'inactive' || normalized === 'deleted') {
    return normalized
  }
  return 'all'
}

/**
 * @param {object} row
 */
export function mapBillingPromotionCodeAdminRow(row) {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    type: row.type,
    freeMonths: row.free_months == null ? null : Number(row.free_months),
    isActive: Boolean(row.is_active),
    usedCount: Number(row.used_count ?? 0),
    maxRedemptions: row.max_redemptions == null ? null : Number(row.max_redemptions),
    perUserLimit: Number(row.per_user_limit ?? 1),
    appliesToProduct: row.applies_to_product ?? 'insurance',
    appliesToPlanCode: row.applies_to_plan_code ?? null,
    amountOff: row.amount_off == null ? null : Number(row.amount_off),
    percentOff: row.percent_off == null ? null : Number(row.percent_off),
    applyScope: row.apply_scope ?? 'all',
    memo: row.admin_memo ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    deletedAt: row.deleted_at ?? null,
    deletedBy: row.deleted_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {'all' | 'active' | 'inactive' | 'deleted'} filter
 */
export function buildPromotionListWhereClause(filter) {
  if (filter === 'active') {
    return 'deleted_at IS NULL AND is_active = true'
  }
  if (filter === 'inactive') {
    return 'deleted_at IS NULL AND is_active = false'
  }
  if (filter === 'deleted') {
    return 'deleted_at IS NOT NULL'
  }
  return 'deleted_at IS NULL'
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ filter?: string }} params
 */
export async function listBillingPromotionCodesAdmin(executor, params = {}) {
  const filter = normalizePromotionListFilter(params.filter)
  const where = buildPromotionListWhereClause(filter)
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM billing_promotion_codes
    WHERE ${where}
    ORDER BY created_at DESC, id DESC
    `,
  )
  return r.rows.map(mapBillingPromotionCodeAdminRow)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number | string} codeId
 */
export async function getBillingPromotionCodeAdminById(executor, codeId) {
  const r = await systemQuery(
    executor,
    `SELECT * FROM billing_promotion_codes WHERE id = $1 LIMIT 1`,
    [Number(codeId)],
  )
  return r.rows[0] ? mapBillingPromotionCodeAdminRow(r.rows[0]) : null
}

/**
 * @param {object | null | undefined} row
 */
export function assertBillingPromotionCanActivate(row) {
  if (!row) {
    throw new Error('promotion_not_found')
  }
  if (row.deleted_at) {
    throw new Error('promotion_deleted')
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ codeId: number | string; adminUserId: string }} params
 */
export async function activateBillingPromotionCodeAdmin(executor, params) {
  const codeId = Number(params.codeId)
  const r = await systemQuery(
    executor,
    `SELECT * FROM billing_promotion_codes WHERE id = $1 LIMIT 1`,
    [codeId],
  )
  const row = r.rows[0]
  assertBillingPromotionCanActivate(row)

  await systemQuery(
    executor,
    `
    UPDATE billing_promotion_codes
    SET is_active = true, updated_at = NOW()
    WHERE id = $1
    `,
    [codeId],
  )

  await recordBillingEvent(executor, {
    userId: params.adminUserId,
    eventType: 'promotion.admin.activated',
    payload: { promotionCodeId: codeId, code: row.code },
  })

  return { success: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ codeId: number | string; adminUserId: string }} params
 */
export async function deactivateBillingPromotionCodeAdmin(executor, params) {
  const codeId = Number(params.codeId)
  const r = await systemQuery(
    executor,
    `SELECT * FROM billing_promotion_codes WHERE id = $1 LIMIT 1`,
    [codeId],
  )
  const row = r.rows[0]
  if (!row) {
    throw new Error('promotion_not_found')
  }
  if (row.deleted_at) {
    throw new Error('promotion_deleted')
  }

  await systemQuery(
    executor,
    `
    UPDATE billing_promotion_codes
    SET is_active = false, updated_at = NOW()
    WHERE id = $1
    `,
    [codeId],
  )

  await recordBillingEvent(executor, {
    userId: params.adminUserId,
    eventType: 'promotion.admin.deactivated',
    payload: { promotionCodeId: codeId, code: row.code },
  })

  return { success: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ codeId: number | string; adminUserId: string; code: string } & ReturnType<typeof parseUpdateBillingPromotionInput>} params
 */
export async function updateBillingPromotionCodeAdmin(executor, params) {
  const codeId = Number(params.codeId)
  const r = await systemQuery(
    executor,
    `SELECT * FROM billing_promotion_codes WHERE id = $1 LIMIT 1`,
    [codeId],
  )
  const row = r.rows[0]
  if (!row) {
    throw new Error('promotion_not_found')
  }
  if (row.deleted_at) {
    throw new Error('promotion_deleted')
  }

  await systemQuery(
    executor,
    `
    UPDATE billing_promotion_codes
    SET
      name = $2,
      type = $3,
      free_months = $4,
      percent_off = $5,
      amount_off = $6,
      max_redemptions = $7,
      applies_to_plan_code = $8,
      apply_scope = $9,
      admin_memo = $10,
      updated_at = NOW()
    WHERE id = $1
    `,
    [
      codeId,
      params.name,
      params.type,
      params.freeMonths,
      params.percentOff,
      params.amountOff,
      params.maxRedemptions,
      params.appliesToPlanCode,
      params.applyScope,
      params.adminMemo,
    ],
  )

  const updated = await getBillingPromotionCodeAdminById(executor, codeId)
  await recordBillingEvent(executor, {
    userId: params.adminUserId,
    eventType: 'promotion.admin.updated',
    payload: { promotionCodeId: codeId, code: params.code ?? row.code },
  })
  return updated
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number | string} codeId
 */
export async function getBillingPromotionCodeStatsAdmin(executor, codeId) {
  const promotion = await getBillingPromotionCodeAdminById(executor, codeId)
  if (!promotion) {
    throw new Error('promotion_not_found')
  }

  const statsR = await systemQuery(
    executor,
    `
    SELECT
      COUNT(*)::int AS redemption_count,
      COUNT(DISTINCT user_id)::int AS account_count
    FROM billing_promotion_redemptions
    WHERE promotion_code_id = $1
    `,
    [Number(codeId)],
  )
  const recentR = await systemQuery(
    executor,
    `
    SELECT id, user_id, redeemed_at, free_ends_at
    FROM billing_promotion_redemptions
    WHERE promotion_code_id = $1
    ORDER BY redeemed_at DESC
    LIMIT 10
    `,
    [Number(codeId)],
  )

  return {
    promotion,
    redemptionCount: Number(statsR.rows[0]?.redemption_count ?? 0),
    accountCount: Number(statsR.rows[0]?.account_count ?? 0),
    recentRedemptions: recentR.rows.map((item) => ({
      id: Number(item.id),
      userId: item.user_id,
      redeemedAt: item.redeemed_at,
      freeEndsAt: item.free_ends_at,
    })),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ codeId: number | string; adminUserId: string }} params
 */
export async function softDeleteBillingPromotionCodeAdmin(executor, params) {
  const codeId = Number(params.codeId)
  const r = await systemQuery(
    executor,
    `SELECT * FROM billing_promotion_codes WHERE id = $1 LIMIT 1`,
    [codeId],
  )
  const row = r.rows[0]
  if (!row) {
    throw new Error('promotion_not_found')
  }
  if (row.deleted_at) {
    return { success: true, alreadyDeleted: true }
  }

  await systemQuery(
    executor,
    `
    UPDATE billing_promotion_codes
    SET
      is_active = false,
      deleted_at = NOW(),
      deleted_by = $2,
      updated_at = NOW()
    WHERE id = $1
    `,
    [codeId, params.adminUserId],
  )

  await recordBillingEvent(executor, {
    userId: params.adminUserId,
    eventType: 'promotion.admin.deleted',
    payload: { promotionCodeId: codeId, code: row.code },
  })

  return { success: true }
}
