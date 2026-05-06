/**
 * CRM-Platform 메타 조회 전용 API (SUPER_ADMIN).
 * — industries / tenants / user_memberships / 외부 계정 요약
 * — CUD 없음 · 민감 필드 미포함
 */

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
