/**
 * CRM-Platform 메타 API (SUPER_ADMIN / platform 컨텍스트).
 * — industries 조회(GET)는 레거시 requireSuperAdmin
 * — industry 생성(POST)는 platform 컨텍스트 기반 플랫폼 슈퍼관리자 가드
 * — industries/:id/admins 조회·지정은 platform 컨텍스트 + 플랫폼 슈퍼
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
 * `industryId` URL param — 양의 정수 문자열만 허용 (앞뒤 공백 허용 후 검사).
 * @param {unknown} raw
 * @returns {number | null}
 */
function parsePositiveIndustryIdParam(raw) {
  if (raw === undefined || raw === null) {
    return null
  }
  const s = String(raw).trim()
  if (!/^[1-9]\d*$/.test(s)) {
    return null
  }
  const n = Number(s)
  if (!Number.isSafeInteger(n) || n < 1) {
    return null
  }
  return n
}

/**
 * @param {object} row
 */
function mapIndustryAdminMemberItem(row) {
  return {
    membershipId: String(row.membership_id),
    userId: String(row.user_id),
    username: String(row.username ?? ''),
    legacyRole: String(row.legacy_role ?? ''),
    membershipRole: String(row.membership_role ?? ''),
    scopeType: String(row.scope_type ?? ''),
    scopeId: row.scope_id != null ? String(row.scope_id) : '',
    industryId: row.industry_id != null ? String(row.industry_id) : '',
    status: String(row.status ?? ''),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

/**
 * @param {object} row
 * @param {'created' | 'already_active' | 'reactivated'} result
 */
function mapIndustryAdminAssignResponse(row, result) {
  return {
    ...mapIndustryAdminMemberItem(row),
    result,
  }
}

/**
 * 단일 industry_admin membership 행 + 사용자 (지정/조회 공용).
 * @param {import('pg').Pool | import('pg').PoolClient} exec
 * @param {number} industryId
 * @param {string} userId
 * @returns {Promise<object | null>}
 */
async function selectIndustryAdminMembershipForUser(exec, industryId, userId) {
  const scopeIdStr = String(industryId)
  const { rows } = await exec.query(
    `
    SELECT
      m.id AS membership_id,
      m.user_id,
      u.username,
      u.role AS legacy_role,
      m.role AS membership_role,
      m.scope_type,
      m.scope_id,
      m.industry_id,
      m.status,
      m.created_at,
      m.updated_at
    FROM user_memberships m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.user_id = $1
      AND m.role = 'industry_admin'
      AND m.scope_type = 'industry'
      AND COALESCE(m.scope_id, '') = $2
      AND m.industry_id = $3
    `,
    [userId, scopeIdStr, industryId],
  )
  return rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} exec
 * @param {number} membershipId
 */
async function selectIndustryAdminMembershipById(exec, membershipId) {
  const { rows } = await exec.query(
    `
    SELECT
      m.id AS membership_id,
      m.user_id,
      u.username,
      u.role AS legacy_role,
      m.role AS membership_role,
      m.scope_type,
      m.scope_id,
      m.industry_id,
      m.status,
      m.created_at,
      m.updated_at
    FROM user_memberships m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.id = $1
    `,
    [membershipId],
  )
  return rows[0] ?? null
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

  apiRouter.get(
    '/admin/platform/industries/:industryId/admins',
    ...platformSuperCreateGuard,
    async (req, res) => {
      try {
        const industryIdParsed = parsePositiveIndustryIdParam(req.params.industryId)
        if (industryIdParsed == null) {
          res.status(400).json({ message: '유효한 industryId 가 필요합니다.' })
          return
        }
        const scopeIdStr = String(industryIdParsed)

        const exists = await pool.query(`SELECT id FROM industries WHERE id = $1 LIMIT 1`, [
          industryIdParsed,
        ])
        if ((exists.rowCount ?? 0) === 0) {
          res.status(404).json({ message: '해당 업종을 찾을 수 없습니다.' })
          return
        }

        const { rows } = await pool.query(
          `
          SELECT
            m.id AS membership_id,
            m.user_id,
            u.username,
            u.role AS legacy_role,
            m.role AS membership_role,
            m.scope_type,
            m.scope_id,
            m.industry_id,
            m.status,
            m.created_at,
            m.updated_at
          FROM user_memberships m
          INNER JOIN users u ON u.id = m.user_id
          WHERE m.industry_id = $1
            AND m.role = 'industry_admin'
            AND m.scope_type = 'industry'
            AND COALESCE(m.scope_id, '') = $2
            AND m.status = 'active'
            AND COALESCE(u.is_deleted, FALSE) IS NOT TRUE
            AND LOWER(TRIM(COALESCE(u.status::text, ''))) = 'active'
          ORDER BY m.id ASC
          `,
          [industryIdParsed, scopeIdStr],
        )

        res.json({
          items: rows.map((row) => mapIndustryAdminMemberItem(row)),
        })
      } catch (e) {
        handleDbError(e, req, res)
      }
    },
  )

  apiRouter.post(
    '/admin/platform/industries/:industryId/admins',
    ...platformSuperCreateGuard,
    async (req, res) => {
      const industryIdParsed = parsePositiveIndustryIdParam(req.params.industryId)
      if (industryIdParsed == null) {
        res.status(400).json({ message: '유효한 industryId 가 필요합니다.' })
        return
      }
      const body = req.body
      const rawUserId = body?.userId
      if (rawUserId === undefined || rawUserId === null) {
        res.status(400).json({ message: 'userId가 필요합니다.' })
        return
      }
      if (typeof rawUserId !== 'string') {
        res.status(400).json({ message: 'userId는 문자열이어야 합니다.' })
        return
      }
      const userIdTrim = rawUserId.trim()
      if (userIdTrim === '') {
        res.status(400).json({ message: 'userId가 필요합니다.' })
        return
      }

      const scopeIdStr = String(industryIdParsed)

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        const existsInd = await client.query(`SELECT id FROM industries WHERE id = $1 LIMIT 1`, [
          industryIdParsed,
        ])
        if ((existsInd.rowCount ?? 0) === 0) {
          await client.query('ROLLBACK')
          res.status(404).json({ message: '해당 업종을 찾을 수 없습니다.' })
          return
        }

        const userCheck = await client.query(
          `
          SELECT id
          FROM users
          WHERE id = $1
            AND COALESCE(is_deleted, FALSE) IS NOT TRUE
            AND LOWER(TRIM(COALESCE(status::text, ''))) = 'active'
          LIMIT 1
          `,
          [userIdTrim],
        )
        if ((userCheck.rowCount ?? 0) === 0) {
          await client.query('ROLLBACK')
          res.status(404).json({
            message: '사용자를 찾을 수 없거나 활성 상태가 아닙니다.',
          })
          return
        }

        const existing = await client.query(
          `
          SELECT id AS membership_id, status
          FROM user_memberships
          WHERE user_id = $1
            AND role = 'industry_admin'
            AND scope_type = 'industry'
            AND COALESCE(scope_id, '') = $2
            AND industry_id = $3
          FOR UPDATE
          `,
          [userIdTrim, scopeIdStr, industryIdParsed],
        )

        if ((existing.rowCount ?? 0) > 0) {
          /** @type {{ membership_id?: unknown; status?: unknown }} */
          const ex = existing.rows[0]
          const mid = Number(ex.membership_id)
          const stRaw = String(ex.status ?? '').trim().toLowerCase()

          if (stRaw === 'active') {
            const fullActive = await selectIndustryAdminMembershipById(client, mid)
            await client.query('COMMIT')
            if (fullActive != null) {
              await logSecurityEvent(pool, {
                actorUserId: String(req.user?.id ?? ''),
                actorRole: String(req.user?.role ?? ''),
                action: 'PLATFORM_INDUSTRY_ADMIN_ASSIGN',
                targetType: 'user_membership',
                targetId: String(mid),
                meta: {
                  industryId: industryIdParsed,
                  userId: userIdTrim,
                  result: 'already_active',
                },
              })
              res
                .status(200)
                .json(mapIndustryAdminAssignResponse(fullActive, 'already_active'))
            } else {
              handleDbError(new Error('[platform-admin] stale membership'), req, res)
            }
            return
          }

          await client.query(
            `
            UPDATE user_memberships
            SET status = 'active',
                updated_at = NOW()
            WHERE id = $1
            `,
            [mid],
          )
          const reactivatedRow = await selectIndustryAdminMembershipById(client, mid)
          await client.query('COMMIT')
          if (reactivatedRow != null) {
            await logSecurityEvent(pool, {
              actorUserId: String(req.user?.id ?? ''),
              actorRole: String(req.user?.role ?? ''),
              action: 'PLATFORM_INDUSTRY_ADMIN_ASSIGN',
              targetType: 'user_membership',
              targetId: String(mid),
              meta: {
                industryId: industryIdParsed,
                userId: userIdTrim,
                result: 'reactivated',
              },
            })
            res
              .status(200)
              .json(mapIndustryAdminAssignResponse(reactivatedRow, 'reactivated'))
          } else {
            handleDbError(new Error('[platform-admin] reactivate inconsistent'), req, res)
          }
          return
        }

        /** @type {unknown} */
        let insertErr = null
        try {
          const insRes = await client.query(
            `
            INSERT INTO user_memberships (
              user_id,
              role,
              scope_type,
              scope_id,
              industry_id,
              tenant_id,
              status
            )
            VALUES ($1, 'industry_admin', 'industry', $2, $3, NULL, 'active')
            RETURNING id
            `,
            [userIdTrim, scopeIdStr, industryIdParsed],
          )
          const newIdRaw = insRes.rows[0]?.id
          const newId = typeof newIdRaw === 'bigint' ? Number(newIdRaw) : Number(newIdRaw)
          const createdRow = await selectIndustryAdminMembershipById(client, newId)
          if (createdRow == null) {
            throw new Error('[platform-admin] insert inconsistent')
          }
          await client.query('COMMIT')
          await logSecurityEvent(pool, {
            actorUserId: String(req.user?.id ?? ''),
            actorRole: String(req.user?.role ?? ''),
            action: 'PLATFORM_INDUSTRY_ADMIN_ASSIGN',
            targetType: 'user_membership',
            targetId: String(newId),
            meta: {
              industryId: industryIdParsed,
              userId: userIdTrim,
              result: 'created',
            },
          })
          res.status(201).json(mapIndustryAdminAssignResponse(createdRow, 'created'))
        } catch (ie) {
          if (
            ie &&
            typeof ie === 'object' &&
            'code' in ie &&
            /** @type {{ code?: string }} */ (ie).code === '23505'
          ) {
            await client.query('ROLLBACK')
            /** @type {unknown} */
            const recovered = await selectIndustryAdminMembershipForUser(
              pool,
              industryIdParsed,
              userIdTrim,
            )
            const recSt =
              recovered != null ? String(recovered.status ?? '').trim().toLowerCase() : ''
            if (recovered != null && recSt === 'active') {
              await logSecurityEvent(pool, {
                actorUserId: String(req.user?.id ?? ''),
                actorRole: String(req.user?.role ?? ''),
                action: 'PLATFORM_INDUSTRY_ADMIN_ASSIGN',
                targetType: 'user_membership',
                targetId: String(recovered.membership_id),
                meta: {
                  industryId: industryIdParsed,
                  userId: userIdTrim,
                  result: 'already_active',
                },
              })
              res
                .status(200)
                .json(
                  mapIndustryAdminAssignResponse(
                    /** @type {object} */ (recovered),
                    'already_active',
                  ),
                )
            } else {
              res.status(409).json({ message: '멤버십이 충돌했습니다.' })
            }
            return
          }
          insertErr = ie
        }
        if (insertErr != null) {
          throw insertErr
        }
      } catch (e) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* already rolled back 또는 연결 상태 */
        }
        handleDbError(e, req, res)
      } finally {
        client.release()
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
