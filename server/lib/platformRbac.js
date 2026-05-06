/**
 * CRM-Platform RBAC — user_memberships 중심 헬퍼 (1차).
 * - requireAuth·JWT·기존 라우트에 연결하지 않는다(별도 rollout).
 * @module platformRbac
 */

import { resolveMembershipsForUser } from './crmPlatformMeta.js'
import { isSuperAdminRole } from './rbacScope.js'

/** 플랫폼 멤버십 역할(스네이크, DB user_memberships.role 과 정합). */
const CANONICAL_PLATFORM_ROLES = Object.freeze([
  'super_admin',
  'industry_admin',
  'tenant_admin',
  'staff',
  'user',
])

const CANONICAL_SET = new Set(CANONICAL_PLATFORM_ROLES)

/**
 * @typedef {Object} UserLike
 * @property {string} id
 * @property {unknown} [role] users.role JWT/req.user 근사
 */

/**
 * @typedef {Object} UserMembershipRow
 * DB `user_memberships` SELECT * 행 shape.
 * @property {string|number|bigint} [id]
 * @property {string} user_id
 * @property {string} role
 * @property {string} scope_type
 * @property {string|null} [scope_id]
 * @property {string|number|bigint|null} [tenant_id]
 * @property {string|number|bigint|null} [industry_id]
 * @property {string} [status]
 */

/**
 * @typedef {Object} EffectivePlatformContext
 * @property {string} userId
 * @property {string} legacyRole
 * @property {boolean} isSuperAdmin
 * @property {readonly UserMembershipRow[]} memberships
 * @property {readonly string[]} industryAdminIndustryIds
 * @property {readonly string[]} tenantAdminTenantIds
 * @property {readonly string[]} staffTenantIds
 * @property {readonly string[]} userTenantIds
 */

/**
 * 플랫폼 멤버십 role 문자열을 정규화한다.
 * @param {unknown} role
 * @returns {typeof CANONICAL_PLATFORM_ROLES[number] | null} 알 수 없으면 null
 */
export function normalizePlatformRole(role) {
  const s = String(role ?? '')
    .trim()
    .toLowerCase()
  if (!s) {
    return null
  }
  if (CANONICAL_SET.has(s)) {
    return /** @type {typeof CANONICAL_PLATFORM_ROLES[number]} */ (s)
  }
  return null
}

/**
 * @param {unknown} id
 * @returns {string|null}
 */
function normalizeIdKey(id) {
  if (id === undefined || id === null) {
    return null
  }
  const s = String(id).trim()
  return s === '' ? null : s
}

/**
 * 활성 멤버십만 로드(resolveMembershipsForUser 재사용).
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {string | null | undefined} userId
 * @returns {Promise<UserMembershipRow[]>}
 */
export async function loadActiveMembershipsForUser(pool, userId) {
  const uid = userId != null ? String(userId).trim() : ''
  if (!uid) {
    return []
  }
  /** @type {UserMembershipRow[]} */
  const rows = await resolveMembershipsForUser(pool, uid)
  return rows ?? []
}

/**
 * 멤버십 배열과 레거시 유저 정보로 플랫폼 컨텍스트를 만든다.
 * @param {{ user: UserLike, memberships: UserMembershipRow[] }} args
 * @returns {EffectivePlatformContext}
 */
export function buildEffectivePlatformContext({ user, memberships }) {
  const userId = user?.id != null ? String(user.id).trim() : ''
  const legacyRole =
    typeof user?.role === 'string' ? user.role.trim() : String(user?.role ?? '').trim()

  /** @type {Set<string>} */
  const industryAdmin = new Set()
  /** @type {Set<string>} */
  const tenantAdmin = new Set()
  /** @type {Set<string>} */
  const staffTenants = new Set()
  /** @type {Set<string>} */
  const userTenants = new Set()

  let membershipSuperAdmin = false

  const list = Array.isArray(memberships) ? memberships : []
  for (const m of list) {
    const pr = normalizePlatformRole(m.role)
    const scopeType = String(m.scope_type ?? '').trim().toLowerCase()

    if (pr === 'super_admin' && scopeType === 'platform') {
      membershipSuperAdmin = true
      continue
    }

    if (pr === 'industry_admin' && scopeType === 'industry') {
      const iid =
        normalizeIdKey(m.industry_id) ??
        normalizeIdKey(m.scope_id)
      if (iid !== null) {
        industryAdmin.add(iid)
      }
      continue
    }

    if (pr === 'tenant_admin' && scopeType === 'tenant') {
      const tid =
        normalizeIdKey(m.tenant_id) ??
        normalizeIdKey(m.scope_id)
      if (tid !== null) {
        tenantAdmin.add(tid)
      }
      continue
    }

    if (pr === 'staff' && scopeType === 'tenant') {
      const tid =
        normalizeIdKey(m.tenant_id) ??
        normalizeIdKey(m.scope_id)
      if (tid !== null) {
        staffTenants.add(tid)
      }
      continue
    }

    if (pr === 'user' && scopeType === 'tenant') {
      const tid =
        normalizeIdKey(m.tenant_id) ??
        normalizeIdKey(m.scope_id)
      if (tid !== null) {
        userTenants.add(tid)
      }
    }
  }

  const legacySuper = legacyRole !== '' && isSuperAdminRole(legacyRole)

  /** @type {EffectivePlatformContext} */
  const context = Object.freeze({
    userId,
    legacyRole,
    isSuperAdmin: legacySuper || membershipSuperAdmin,
    memberships: Object.freeze(list.map((row) => Object.freeze({ ...row }))),
    industryAdminIndustryIds: Object.freeze([...industryAdmin].sort()),
    tenantAdminTenantIds: Object.freeze([...tenantAdmin].sort()),
    staffTenantIds: Object.freeze([...staffTenants].sort()),
    userTenantIds: Object.freeze([...userTenants].sort()),
  })

  return context
}

/**
 * 활성 멤버십 중 해당 플랫폼 역할 문자열이 하나라도 있는지.
 * @param {EffectivePlatformContext} context
 * @param {unknown} role
 */
export function hasPlatformRole(context, role) {
  const want = normalizePlatformRole(role)
  if (!want) {
    return false
  }
  if (want === 'super_admin' && isPlatformSuperAdmin(context)) {
    return true
  }
  for (const m of context.memberships) {
    if (normalizePlatformRole(m.role) === want) {
      return true
    }
  }
  return false
}

/**
 * @param {EffectivePlatformContext} context
 */
export function isPlatformSuperAdmin(context) {
  return context.isSuperAdmin === true
}

/**
 * 업종 단위 관리자 또는 플랫폼 슈퍼관리자 여부.
 * @param {EffectivePlatformContext} context
 * @param {unknown} industryId
 */
export function hasIndustryAdminScope(context, industryId) {
  if (isPlatformSuperAdmin(context)) {
    return true
  }
  const key = normalizeIdKey(industryId)
  if (key === null) {
    return false
  }
  return context.industryAdminIndustryIds.includes(key)
}

/**
 * 테넌트 단위 관리자 또는 플랫폼 슈퍼관리자 여부.
 * @param {EffectivePlatformContext} context
 * @param {unknown} tenantId
 */
export function hasTenantAdminScope(context, tenantId) {
  if (isPlatformSuperAdmin(context)) {
    return true
  }
  const key = normalizeIdKey(tenantId)
  if (key === null) {
    return false
  }
  return context.tenantAdminTenantIds.includes(key)
}

/*
 * ─── Phase 2 (미구현) ───────────────────────────────────────────────
 * 아래 패턴으로 Express 미들웨어를 붙일 수 있다. 지금은 라우트에 연결 금지.
 *
 * async function attachPlatformContext(pool) {
 *   return async (req, res, next) => {
 *     if (!req.user?.id) { return res.status(401).json({ message: '...' }); }
 *     const memberships = await loadActiveMembershipsForUser(pool, req.user.id);
 *     req.platformContext = buildEffectivePlatformContext({ user: req.user, memberships });
 *     next();
 *   };
 * }
 *
 * function requireIndustryAdminParam(paramName = 'industryId') {
 *   return (req, res, next) => {
 *     const raw = req.params[paramName];
 *     if (!hasIndustryAdminScope(req.platformContext, raw)) return res.status(403).json(...);
 *     next();
 *   };
 * }
 *
 * function requireTenantAdminParam(paramName = 'tenantId') {
 *   return (req, res, next) => {
 *     const raw = req.params[paramName];
 *     if (!hasTenantAdminScope(req.platformContext, raw)) return res.status(403).json(...);
 *     next();
 *   };
 * }
 */
