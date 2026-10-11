import { parseGaId } from './lib/parseGaId.js'
import { normalizeRbacRole } from './lib/rbacScope.js'
import { safeQuery } from './utils/dbSafeQuery.js'

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function mapGaAdminAccountRow(row) {
  const st = String(row.status ?? 'active').toLowerCase()
  let statusLabel = 'ACTIVE'
  if (st === 'blocked') {
    statusLabel = 'BLOCKED'
  } else if (st === 'inactive') {
    statusLabel = 'INACTIVE'
  }
  const phone = String(row.phone_number ?? '').trim()
  return {
    id: String(row.id),
    ga_id: Number(row.ga_id),
    username: String(row.username ?? '').trim(),
    displayName: String(row.display_name ?? '').trim(),
    phone_number: phone || null,
    role: 'GA_ADMIN',
    status: st,
    statusLabel,
    created_at: row.created_at ? String(row.created_at) : null,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
  }
}

const GA_ADMIN_LIST_SQL = `
  SELECT
    u.id,
    u.username,
    u.role,
    u.status,
    u.created_at,
    u.last_login_at,
    u.ga_id,
    u.display_name,
    u.phone_number
  FROM users u
  INNER JOIN ga_companies g ON g.id = u.ga_id
  WHERE u.is_deleted = false
    AND g.is_deleted = false
    AND u.ga_id = $1
    AND UPPER(TRIM(COALESCE(u.role, ''))) = 'GA_ADMIN'
  ORDER BY u.created_at ASC, u.username ASC
`

const GA_ADMIN_BY_ID_SQL = `
  SELECT
    u.id,
    u.username,
    u.role,
    u.status,
    u.created_at,
    u.last_login_at,
    u.ga_id,
    u.display_name,
    u.phone_number
  FROM users u
  INNER JOIN ga_companies g ON g.id = u.ga_id
  WHERE u.is_deleted = false
    AND g.is_deleted = false
    AND u.ga_id = $1
    AND u.id = $2
    AND UPPER(TRIM(COALESCE(u.role, ''))) = 'GA_ADMIN'
  LIMIT 1
`

/**
 * SUPER_ADMIN — GA 상세에서 해당 GA의 GA_ADMIN 계정만 관리.
 *
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 */
export function registerSuperAdminGaAdminAccountsApi(apiRouter, ctx) {
  const {
    pool,
    requireAuth,
    requireSuperAdmin,
    handleDbError,
    systemQuery,
    bcrypt,
    validateCredentials,
    isUsernameTakenGlobally,
    parseEntityStatus,
    tryCreateGaDelegateFromRequest,
    toIsoString,
  } = ctx

  function parseRouteGaId(req, res) {
    const gaId = parseGaId(req.params.gaId)
    if (gaId == null) {
      res.status(400).json({ message: '유효하지 않은 GA ID입니다.' })
      return null
    }
    return gaId
  }

  apiRouter.get('/admin/ga/:gaId/ga-admins', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const gaId = parseRouteGaId(req, res)
      if (gaId == null) {
        return
      }
      const r = await systemQuery(pool, GA_ADMIN_LIST_SQL, [gaId])
      res.json(
        r.rows.map((row) => ({
          ...mapGaAdminAccountRow(row),
          created_at: toIsoString(row.created_at),
          last_login_at: row.last_login_at ? toIsoString(row.last_login_at) : null,
        })),
      )
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/admin/ga/:gaId/ga-admins', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const gaId = parseRouteGaId(req, res)
      if (gaId == null) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const result = await tryCreateGaDelegateFromRequest(
        {
          ...req,
          body: {
            ...body,
            ga_id: gaId,
            gaId,
            role: 'GA_ADMIN',
          },
        },
        { forGaAdmin: false },
      )
      if (!result.ok) {
        res.status(result.status).json({ message: result.message })
        return
      }

      const phoneRaw = body.phone_number ?? body.phoneNumber
      const phoneNorm = normalizePhoneNumber(phoneRaw)
      if (phoneNorm) {
        if (phoneNorm.length < 10 || phoneNorm.length > 11) {
          res.status(400).json({ message: '휴대폰 번호 형식이 올바르지 않습니다.' })
          return
        }
        await safeQuery(
          pool,
          `UPDATE users SET phone_number = $1 WHERE id = $2 AND ga_id = $3 AND is_deleted = false`,
          [phoneNorm, result.id, gaId],
          { allowUnscoped: true },
        )
      }

      const rowQ = await systemQuery(pool, GA_ADMIN_BY_ID_SQL, [gaId, result.id])
      const row = rowQ.rows[0]
      if (!row) {
        res.status(500).json({ message: '생성된 계정을 조회하지 못했습니다.' })
        return
      }
      res.status(201).json({
        ...mapGaAdminAccountRow(row),
        created_at: toIsoString(row.created_at),
        last_login_at: row.last_login_at ? toIsoString(row.last_login_at) : null,
      })
    } catch (error) {
      if (error?.code === '23505') {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/admin/ga/:gaId/ga-admins/:userId', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const gaId = parseRouteGaId(req, res)
      if (gaId == null) {
        return
      }
      const targetId = String(req.params.userId ?? '').trim()
      if (!targetId) {
        res.status(400).json({ message: '잘못된 ID입니다.' })
        return
      }

      const curQ = await systemQuery(
        pool,
        `
        SELECT id, username, role, status, ga_id, display_name, phone_number
        FROM users
        WHERE id = $1 AND is_deleted = false
        `,
        [targetId],
      )
      if (curQ.rowCount === 0) {
        res.status(404).json({ message: '계정을 찾을 수 없습니다.' })
        return
      }
      const cur = curQ.rows[0]
      const curGaId = parseGaId(cur.ga_id)
      if (curGaId == null || curGaId !== gaId) {
        res.status(403).json({ message: '다른 GA의 계정은 수정할 수 없습니다.' })
        return
      }
      if (normalizeRbacRole(cur.role) !== 'GA_ADMIN') {
        res.status(403).json({ message: 'GA_ADMIN 계정만 수정할 수 있습니다.' })
        return
      }

      const body = req.body ?? {}
      let newDisplayName = null
      if (Object.prototype.hasOwnProperty.call(body, 'name') || Object.prototype.hasOwnProperty.call(body, 'displayName')) {
        newDisplayName = String(body.displayName ?? body.name ?? '').trim()
      }
      let newUsername = null
      if (Object.prototype.hasOwnProperty.call(body, 'username')) {
        newUsername = String(body.username ?? '').trim()
        if (!newUsername || newUsername.length < 3 || newUsername.length > 30) {
          res.status(400).json({ message: '아이디는 3~30자여야 합니다.' })
          return
        }
      }
      let newPhone = null
      let clearPhone = false
      if (Object.prototype.hasOwnProperty.call(body, 'phone_number') || Object.prototype.hasOwnProperty.call(body, 'phoneNumber')) {
        const raw = body.phone_number ?? body.phoneNumber
        const norm = normalizePhoneNumber(raw)
        if (!norm) {
          clearPhone = true
        } else if (norm.length < 10 || norm.length > 11) {
          res.status(400).json({ message: '휴대폰 번호 형식이 올바르지 않습니다.' })
          return
        } else {
          newPhone = norm
        }
      }
      let newStatus = null
      if (Object.prototype.hasOwnProperty.call(body, 'status')) {
        newStatus = parseEntityStatus(body.status)
        if (!newStatus) {
          res.status(400).json({ message: 'status는 active, blocked, inactive 중 하나여야 합니다.' })
          return
        }
      }
      let passwordUpdate = null
      if (Object.prototype.hasOwnProperty.call(body, 'password')) {
        const p = body.password
        if (typeof p === 'string' && p.trim() !== '') {
          const validationMessage = validateCredentials(cur.username, p)
          if (validationMessage) {
            res.status(400).json({ message: validationMessage })
            return
          }
          passwordUpdate = p
        }
      }

      if (newUsername != null && newUsername !== cur.username) {
        if (await isUsernameTakenGlobally(pool, newUsername, { excludeUserId: targetId })) {
          res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
          return
        }
      }

      const setParts = []
      const vals = []
      let n = 1
      if (newDisplayName != null) {
        setParts.push(`display_name = $${n++}`)
        vals.push(newDisplayName)
      }
      if (newUsername != null && newUsername !== cur.username) {
        setParts.push(`username = $${n++}`)
        vals.push(newUsername)
      }
      if (clearPhone) {
        setParts.push(`phone_number = NULL`)
      } else if (newPhone != null) {
        setParts.push(`phone_number = $${n++}`)
        vals.push(newPhone)
      }
      const curStatus = String(cur.status ?? 'active').toLowerCase()
      if (newStatus != null && newStatus !== curStatus) {
        setParts.push(`status = $${n++}`)
        vals.push(newStatus)
      }
      if (passwordUpdate != null) {
        setParts.push(`password_hash = $${n++}`)
        vals.push(await bcrypt.hash(passwordUpdate, 10))
        setParts.push(`delegate_password_plaintext = NULL`)
      }

      if (setParts.length > 0) {
        vals.push(targetId, gaId)
        await safeQuery(
          pool,
          `
          UPDATE users
          SET ${setParts.join(', ')}
          WHERE id = $${n} AND ga_id = $${n + 1} AND is_deleted = false
          RETURNING id
          `,
          vals,
          { allowUnscoped: true },
        )
      }

      const rowQ = await systemQuery(pool, GA_ADMIN_BY_ID_SQL, [gaId, targetId])
      const row = rowQ.rows[0]
      if (!row) {
        res.status(404).json({ message: '계정을 찾을 수 없습니다.' })
        return
      }
      res.json({
        ...mapGaAdminAccountRow(row),
        created_at: toIsoString(row.created_at),
        last_login_at: row.last_login_at ? toIsoString(row.last_login_at) : null,
      })
    } catch (error) {
      if (error?.code === '23505') {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })
}

export { mapGaAdminAccountRow, normalizePhoneNumber as normalizeGaAdminAccountPhone }
