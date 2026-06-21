import { systemQuery } from '../utils/dbSafeQuery.js'
import { recordBillingEvent } from './subscriptionLifecycle.js'

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
