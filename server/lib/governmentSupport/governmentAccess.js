/**
 * government-support 접근 판별 (platformContext 확장 필드 사용).
 * @module governmentAccess
 */

import { createAttachPlatformContext, isPlatformSuperAdmin } from '../platformRbac.js'
import { GOVERNMENT_INDUSTRY_CODE } from './constants.js'

/**
 * @param {import('../platformRbac.js').EffectivePlatformContext} ctx
 */
export function isGovernmentSuperAdmin(ctx) {
  return isPlatformSuperAdmin(ctx)
}

/**
 * @param {import('../platformRbac.js').EffectivePlatformContext} ctx
 */
export function isGovernmentIndustryAdmin(ctx) {
  if (isGovernmentSuperAdmin(ctx)) {
    return true
  }
  return (ctx.governmentIndustryAdminIndustryIds?.length ?? 0) > 0
}

/**
 * @param {import('../platformRbac.js').EffectivePlatformContext} ctx
 */
export function isGovernmentTenantMember(ctx) {
  if (isGovernmentIndustryAdmin(ctx)) {
    return true
  }
  return (
    (ctx.governmentAgencyAdminTenantIds?.length ?? 0) > 0 ||
    (ctx.governmentStaffTenantIds?.length ?? 0) > 0
  )
}

/**
 * @param {import('../platformRbac.js').EffectivePlatformContext} ctx
 * @param {string|null|undefined} tenantId
 */
export function canAccessGovernmentTenant(ctx, tenantId) {
  const tid = tenantId != null ? String(tenantId).trim() : ''
  if (!tid) {
    return false
  }
  if (isGovernmentSuperAdmin(ctx) || isGovernmentIndustryAdmin(ctx)) {
    return true
  }
  const admin = ctx.governmentAgencyAdminTenantIds ?? []
  const staff = ctx.governmentStaffTenantIds ?? []
  return admin.includes(tid) || staff.includes(tid)
}

/**
 * @param {import('pg').Pool} pool
 * @returns {Promise<string|null>} industries.id for government
 */
export async function resolveGovernmentIndustryId(pool) {
  const r = await pool.query(
    `SELECT id::text AS id FROM industries WHERE LOWER(TRIM(code)) = $1 LIMIT 1`,
    [GOVERNMENT_INDUSTRY_CODE],
  )
  const id = r.rows[0]?.id
  return id != null ? String(id).trim() : null
}

/**
 * tenant 가 government 업종인지.
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {string|number} tenantId
 */
export async function isGovernmentSupportTenant(pool, tenantId) {
  const tid = String(tenantId ?? '').trim()
  if (!tid) {
    return false
  }
  const r = await pool.query(
    `
    SELECT 1
    FROM tenants t
    INNER JOIN industries i ON i.id = t.industry_id
    WHERE t.id = $1::bigint AND LOWER(TRIM(i.code)) = $2
    LIMIT 1
    `,
    [tid, GOVERNMENT_INDUSTRY_CODE],
  )
  return (r.rowCount ?? 0) > 0
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('../platformRbac.js').EffectivePlatformContext} ctx
 * @returns {Promise<{ ok: true, tenantIds: string[] } | { ok: false, status: number, message: string }>}
 */
export async function resolveGovernmentTenantScopeForQuery(pool, ctx) {
  if (isGovernmentSuperAdmin(ctx) || isGovernmentIndustryAdmin(ctx)) {
    const r = await pool.query(
      `
      SELECT t.id::text AS id
      FROM tenants t
      INNER JOIN industries i ON i.id = t.industry_id
      WHERE LOWER(TRIM(i.code)) = $1
      `,
      [GOVERNMENT_INDUSTRY_CODE],
    )
    return { ok: true, tenantIds: r.rows.map((row) => String(row.id)) }
  }
  const ids = new Set([
    ...(ctx.governmentAgencyAdminTenantIds ?? []),
    ...(ctx.governmentStaffTenantIds ?? []),
  ])
  if (ids.size === 0) {
    return { ok: false, status: 403, message: 'government-support 접근 권한이 없습니다.' }
  }
  return { ok: true, tenantIds: [...ids] }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ requireAuth: Function, handleDbError: Function }} deps
 */
export function createGovernmentSupportGuards(pool, deps) {
  const { requireAuth, handleDbError } = deps
  const attach = createAttachPlatformContext(pool)

  const requireGovernmentMember = [
    requireAuth,
    attach,
    (req, res, next) => {
      try {
        const ctx = /** @type {import('express').Request & { platformContext?: object }} */ (req)
          .platformContext
        if (!ctx || !isGovernmentTenantMember(ctx)) {
          res.status(403).json({ message: 'government-support 접근 권한이 없습니다.' })
          return
        }
        next()
      } catch (e) {
        handleDbError(e, req, res)
      }
    },
  ]

  const requireGovernmentIndustryAdmin = [
    requireAuth,
    attach,
    (req, res, next) => {
      try {
        const ctx = /** @type {import('express').Request & { platformContext?: object }} */ (req)
          .platformContext
        if (!ctx || !isGovernmentIndustryAdmin(ctx)) {
          res.status(403).json({ message: 'government 업종 관리자 권한이 필요합니다.' })
          return
        }
        next()
      } catch (e) {
        handleDbError(e, req, res)
      }
    },
  ]

  return { requireGovernmentMember, requireGovernmentIndustryAdmin, attach }
}
