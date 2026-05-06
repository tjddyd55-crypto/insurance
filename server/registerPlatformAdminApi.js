/**
 * CRM-Platform 메타 API (SUPER_ADMIN / platform 컨텍스트).
 * — industries 조회(GET)는 레거시 requireSuperAdmin
 * — industry 생성(POST)는 platform 컨택스트 기반 플랫폼 슈퍼관리자 가드
 * — tenants/memberships/외부요약 등은 조회 전용 · 민감 필드 미포함
 */

import {
  createAttachPlatformContext,
  createRequirePlatformSuperAdmin,
} from './lib/platformRbac.js'
import { logSecurityEvent } from './lib/securityAudit.js'

const INDUSTRY_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

const INDUSTRY_STATUS_VALUES = /** @type {const} */ (['active', 'inactive'])

const MAX_CONFIG_JSON_LENGTH = 10_000

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return false
  }
  const p = Object.getPrototypeOf(v)
  return p === Object.prototype || p === null
}

/**
 * @param {unknown} body
 * @returns
 *   | { ok: true, payload: { code: string, name: string, status: string, config: Record<string, unknown> } }
 *   | { ok: false, status: number, message: string }}
 */
function parseIndustryCreateInput(body) {
  const raw = body && typeof body === 'object' && !Array.isArray(body) ? body : {}

  if (raw.code === undefined || raw.code === null) {
    return { ok: false, status: 400, message: 'code가 필요합니다.' }
  }
  if (typeof raw.code !== 'string') {
    return { ok: false, status: 400, message: 'code는 문자열이어야 합니다.' }
  }
  const code = raw.code.trim().toLowerCase()
  if (!code) {
    return { ok: false, status: 400, message: 'code가 필요합니다.' }
  }
  if (!INDUSTRY_CODE_PATTERN.test(code)) {
    return { ok: false, status: 400, message: 'code 형식이 올바르지 않습니다.' }
  }

  if (raw.name === undefined || raw.name === null) {
    return { ok: false, status: 400, message: 'name이 필요합니다.' }
  }
  if (typeof raw.name !== 'string') {
    return { ok: false, status: 400, message: 'name은 문자열이어야 합니다.' }
  }
  const name = raw.name.trim()
  if (name.length < 1) {
    return { ok: false, status: 400, message: 'name이 필요합니다.' }
  }
  if (name.length > 200) {
    return { ok: false, status: 400, message: 'name은 200자 이하여야 합니다.' }
  }

  /** @type {string} */
  let status
  if (
    raw.status === undefined ||
    raw.status === null ||
    String(raw.status).trim() === ''
  ) {
    status = 'active'
  } else {
    if (typeof raw.status !== 'string') {
      return { ok: false, status: 400, message: 'status는 문자열이어야 합니다.' }
    }
    status = raw.status.trim().toLowerCase()
    if (!INDUSTRY_STATUS_VALUES.includes(/** @type {'active' | 'inactive'} */ (status))) {
      return { ok: false, status: 400, message: 'status는 active 또는 inactive 여야 합니다.' }
    }
  }

  /** @type {Record<string, unknown>} */
  let config
  if (raw.config === undefined) {
    config = {}
  } else if (raw.config === null) {
    return { ok: false, status: 400, message: 'config는 plain object 여야 합니다.' }
  } else if (!isPlainObject(raw.config)) {
    return { ok: false, status: 400, message: 'config는 plain object 여야 합니다.' }
  } else {
    config = /** @type {Record<string, unknown>} */ (raw.config)
  }

  return { ok: true, payload: { code, name, status, config } }
}

function toIso(v) {
  if (v == null) {
    return null
  }
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, requireSuperAdmin: import('express').RequestHandler, handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void }} deps
 */
export function registerPlatformAdminApi(apiRouter, deps) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = deps
  const guard = [requireAuth, requireSuperAdmin]

  apiRouter.get('/admin/platform/industries', ...guard, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT id, code, name, status, created_at, updated_at
        FROM industries
        ORDER BY id ASC
      `)
      res.json({
        items: rows.map((row) => ({
          id: String(row.id),
          code: row.code,
          name: row.name,
          status: row.status,
          createdAt: toIso(row.created_at),
          updatedAt: toIso(row.updated_at),
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  const attachPlatformContext = createAttachPlatformContext(pool)
  const requirePlatformSuperAdmin = createRequirePlatformSuperAdmin()
  const platformSuperCreateGuard = [
    requireAuth,
    attachPlatformContext,
    requirePlatformSuperAdmin,
  ]

  apiRouter.post(
    '/admin/platform/industries',
    ...platformSuperCreateGuard,
    async (req, res) => {
      const parsed = parseIndustryCreateInput(req.body)
      if (!parsed.ok) {
        res.status(parsed.status).json({ message: parsed.message })
        return
      }

      const { code, name, status, config } = parsed.payload

      /** @type {string} */
      let configSerialized
      try {
        configSerialized = JSON.stringify(config)
      } catch {
        res.status(400).json({ message: 'config를 직렬화할 수 없습니다.' })
        return
      }
      if (configSerialized.length > MAX_CONFIG_JSON_LENGTH) {
        res
          .status(400)
          .json({ message: 'config JSON 크기는 10000자 이하여야 합니다.' })
        return
      }

      try {
        const { rows } = await pool.query(
          `
          INSERT INTO industries (code, name, status, config)
          VALUES ($1, $2, $3, $4::jsonb)
          RETURNING id, code, name, status, config, created_at, updated_at
          `,
          [code, name, status, configSerialized],
        )
        const row = rows[0]
        await logSecurityEvent(pool, {
          actorUserId: String(req.user?.id ?? ''),
          actorRole: String(req.user?.role ?? ''),
          action: 'PLATFORM_INDUSTRY_CREATE',
          targetType: 'industry',
          targetId: String(row.id),
          meta: { code: row.code, name: row.name },
        })

        /** @type {Record<string, unknown>} */
        const configOut =
          row.config !== null &&
          typeof row.config === 'object' &&
          !Array.isArray(row.config)
            ? /** @type {Record<string, unknown>} */ (row.config)
            : {}

        res.status(201).json({
          id: String(row.id),
          code: row.code,
          name: row.name,
          status: row.status,
          config: configOut,
          createdAt: toIso(row.created_at),
          updatedAt: toIso(row.updated_at),
        })
      } catch (e) {
        if (
          e &&
          typeof e === 'object' &&
          'code' in e &&
          /** @type {{ code?: string }} */ (e).code === '23505'
        ) {
          res.status(409).json({ message: '이미 존재하는 업종 코드입니다.' })
          return
        }
        handleDbError(e, req, res)
      }
    },
  )

  apiRouter.get('/admin/platform/tenants', ...guard, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          t.id,
          t.industry_id,
          i.code AS industry_code,
          t.code,
          t.name,
          t.status,
          t.legacy_ga_id,
          t.created_at,
          t.updated_at
        FROM tenants t
        LEFT JOIN industries i ON i.id = t.industry_id
        ORDER BY t.id ASC
      `)
      res.json({
        items: rows.map((row) => ({
          id: String(row.id),
          industryId: row.industry_id != null ? String(row.industry_id) : null,
          industryCode: row.industry_code != null ? String(row.industry_code) : null,
          code: row.code,
          name: row.name,
          status: row.status,
          legacyGaId: row.legacy_ga_id != null ? Number(row.legacy_ga_id) : null,
          createdAt: toIso(row.created_at),
          updatedAt: toIso(row.updated_at),
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/platform/memberships', ...guard, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          m.id AS membership_id,
          m.user_id,
          u.username,
          u.role AS legacy_role,
          m.role AS membership_role,
          m.scope_type,
          m.scope_id,
          m.tenant_id,
          t.code AS tenant_code,
          m.industry_id,
          ind.code AS industry_code,
          m.status,
          m.created_at,
          m.updated_at
        FROM user_memberships m
        INNER JOIN users u ON u.id = m.user_id
        LEFT JOIN tenants t ON t.id = m.tenant_id
        LEFT JOIN industries ind ON ind.id = m.industry_id
        WHERE COALESCE(u.is_deleted, FALSE) IS NOT TRUE
        ORDER BY u.username ASC NULLS LAST, m.role ASC, m.id ASC
      `)
      res.json({
        items: rows.map((row) => ({
          membershipId: String(row.membership_id),
          userId: String(row.user_id),
          username: String(row.username ?? ''),
          legacyRole: String(row.legacy_role ?? ''),
          membershipRole: String(row.membership_role ?? ''),
          scopeType: String(row.scope_type ?? ''),
          scopeId: row.scope_id != null ? String(row.scope_id) : null,
          tenantId: row.tenant_id != null ? String(row.tenant_id) : null,
          tenantCode: row.tenant_code != null ? String(row.tenant_code) : null,
          industryId: row.industry_id != null ? String(row.industry_id) : null,
          industryCode: row.industry_code != null ? String(row.industry_code) : null,
          status: String(row.status ?? ''),
          createdAt: toIso(row.created_at),
          updatedAt: toIso(row.updated_at),
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/platform/external-accounts/summary', ...guard, async (req, res) => {
    try {
      const tRes = await pool.query(
        `
        SELECT
          t.id,
          t.code,
          t.name,
          t.legacy_ga_id,
          g.code AS ga_code,
          g.name AS ga_name
        FROM tenants t
        INNER JOIN ga_companies g ON g.id = t.legacy_ga_id
        WHERE t.code = 'yjasset'
        LIMIT 1
        `,
      )
      if (tRes.rowCount === 0) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'code=yjasset 인 tenant 가 없습니다. initDb 또는 시드 상태를 확인하세요.',
        })
        return
      }
      const t = tRes.rows[0]
      const gaId = Number(t.legacy_ga_id)
      const imCounts = await pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE is_deleted IS NOT TRUE)::int AS total,
          COUNT(*) FILTER (
            WHERE is_deleted IS NOT TRUE
              AND UPPER(TRIM(COALESCE(status::text, ''))) = 'ACTIVE'
          )::int AS active
        FROM insurer_managers
        WHERE ga_id = $1
        `,
        [gaId],
      )
      const laCounts = await pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE is_deleted IS NOT TRUE)::int AS total,
          COUNT(*) FILTER (
            WHERE is_deleted IS NOT TRUE
              AND UPPER(TRIM(COALESCE(status::text, ''))) = 'ACTIVE'
          )::int AS active
        FROM loss_adjusters
        WHERE ga_id = $1
        `,
        [gaId],
      )
      const imRow = imCounts.rows[0] ?? { total: 0, active: 0 }
      const laRow = laCounts.rows[0] ?? { total: 0, active: 0 }

      res.json({
        tenant: {
          tenantId: String(t.id),
          tenantCode: String(t.code ?? ''),
          tenantName: String(t.name ?? ''),
          legacyGaId: gaId,
          gaCode: String(t.ga_code ?? '').trim(),
          gaName: String(t.ga_name ?? '').trim(),
        },
        insurerManagers: {
          total: Number(imRow.total ?? 0),
          active: Number(imRow.active ?? 0),
        },
        lossAdjusters: {
          total: Number(laRow.total ?? 0),
          active: Number(laRow.active ?? 0),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
