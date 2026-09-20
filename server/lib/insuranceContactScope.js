import { isGaMemberUser } from '../entitlements/featureEntitlementPolicy.js'

/**
 * 원수사 연락처 ownership resolver SSOT.
 *
 * GA MEMBER → GA 공용 (ga_id)
 * GENERAL   → 개인 (user_id)
 *
 * @param {{
 *   user?: {
 *     id?: string | null
 *     role?: string | null
 *     gaCode?: string | null
 *     gaName?: string | null
 *   } | null
 *   effectiveTenantGaId?: (req: unknown) => number | null
 * }} deps
 * @param {import('express').Request} req
 */
export function resolveInsuranceContactScope(deps, req) {
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    return { scope: null, gaId: null, userId: null, reason: 'unauthenticated' }
  }

  if (isGaMemberUser(req.user)) {
    const gaId = deps.effectiveTenantGaId?.(req) ?? null
    if (gaId == null) {
      return { scope: 'GA', gaId: null, userId: null, reason: 'ga_context_missing' }
    }
    return { scope: 'GA', gaId, userId: null, reason: null }
  }

  return { scope: 'USER', gaId: null, userId, reason: null }
}

/**
 * @param {{ scope?: string | null, gaId?: number | null, userId?: string | null }} contactScope
 */
export function buildInsuranceContactWhereClause(contactScope, paramOffset = 1) {
  if (contactScope.scope === 'GA') {
    return {
      sql: `ga_id = $${paramOffset} AND owner_scope = $${paramOffset + 1}`,
      params: [contactScope.gaId, 'GA'],
    }
  }
  if (contactScope.scope === 'USER') {
    return {
      sql: `user_id = $${paramOffset} AND owner_scope = $${paramOffset + 1}`,
      params: [contactScope.userId, 'USER'],
    }
  }
  return null
}
