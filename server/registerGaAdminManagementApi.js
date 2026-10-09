import { parseGaId } from './lib/parseGaId.js'
import { normalizeRbacRole } from './lib/rbacScope.js'
import { safeQuery } from './utils/dbSafeQuery.js'

/**
 * GA_ADMIN 전용 관리 API (STEP·자기 GA scope).
 * 플랫폼 SUPER_ADMIN 전용 /admin/delegates 와 분리한다.
 *
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 */
export function registerGaAdminManagementApi(apiRouter, ctx) {
  const {
    pool,
    requireAuth,
    handleDbError,
    systemQuery,
    bcrypt,
    validateCredentials,
    isUsernameTakenGlobally,
    parseEntityStatus,
    mapGaDelegateAdminRow,
    tryCreateGaDelegateFromRequest,
  } = ctx

  function requireGaAdminRole(req, res, next) {
    if (normalizeRbacRole(req.user?.role) !== 'GA_ADMIN') {
      res.status(403).json({ message: 'GA 관리자만 이용할 수 있습니다.' })
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    next()
  }

  function mapGaDelegateRowForGaAdmin(row) {
    const mapped = mapGaDelegateAdminRow(row)
    return {
      id: mapped.id,
      ga_id: mapped.ga_id,
      gaCode: mapped.gaCode,
      gaName: mapped.gaName,
      username: mapped.username,
      role: mapped.role,
      status: mapped.status,
      statusLabel: mapped.statusLabel,
      created_at: mapped.created_at,
      updated_at: mapped.created_at,
      displayName: String(row.display_name ?? '').trim(),
    }
  }

  apiRouter.get('/ga-admin/delegates', requireAuth, requireGaAdminRole, async (req, res) => {
    try {
      const gaId = parseGaId(req.user?.gaId)
      const r = await systemQuery(
        pool,
        `
        SELECT
          u.id,
          u.username,
          u.role,
          u.status,
          u.created_at,
          u.ga_id,
          u.display_name,
          u.delegate_password_plaintext,
          g.name AS ga_name,
          g.code AS ga_code
        FROM users u
        INNER JOIN ga_companies g ON g.id = u.ga_id
        WHERE u.is_deleted = false
          AND g.is_deleted = false
          AND u.ga_id = $1
          AND u.role IN ('GA_ADMIN', 'GA_STAFF')
        ORDER BY u.role ASC, u.username ASC
        `,
        [gaId],
      )
      res.json(r.rows.map(mapGaDelegateRowForGaAdmin))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/ga-admin/delegates', requireAuth, requireGaAdminRole, async (req, res) => {
    try {
      const gaId = parseGaId(req.user?.gaId)
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const result = await tryCreateGaDelegateFromRequest(
        {
          ...req,
          body: {
            ...body,
            ga_id: gaId,
            gaId,
            role: 'GA_STAFF',
          },
        },
        { forGaAdmin: true },
      )
      if (!result.ok) {
        res.status(result.status).json({ message: result.message })
        return
      }
      const rowQ = await systemQuery(
        pool,
        `
        SELECT
          u.id,
          u.username,
          u.role,
          u.status,
          u.created_at,
          u.ga_id,
          u.display_name,
          u.delegate_password_plaintext,
          g.name AS ga_name,
          g.code AS ga_code
        FROM users u
        INNER JOIN ga_companies g ON g.id = u.ga_id
        WHERE u.id = $1
        `,
        [result.id],
      )
      res.status(201).json(mapGaDelegateRowForGaAdmin(rowQ.rows[0]))
    } catch (error) {
      if (error?.code === '23505') {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/ga-admin/delegates/:id', requireAuth, requireGaAdminRole, async (req, res) => {
    try {
      const actorGaId = parseGaId(req.user?.gaId)
      const targetId = String(req.params.id ?? '').trim()
      if (!targetId) {
        res.status(400).json({ message: '잘못된 ID입니다.' })
        return
      }
      const curQ = await systemQuery(
        pool,
        `
        SELECT id, username, role, status, ga_id, display_name, delegate_password_plaintext
        FROM users
        WHERE id = $1 AND is_deleted = false
        `,
        [targetId],
      )
      if (curQ.rowCount === 0) {
        res.status(404).json({ message: '담당자를 찾을 수 없습니다.' })
        return
      }
      const cur = curQ.rows[0]
      const curGaId = parseGaId(cur.ga_id)
      if (curGaId == null || curGaId !== actorGaId) {
        res.status(403).json({ message: '다른 GA 계정은 수정할 수 없습니다.' })
        return
      }
      const roleNorm = normalizeRbacRole(cur.role)
      if (roleNorm !== 'GA_STAFF') {
        res.status(403).json({ message: 'STEP(GA_STAFF) 계정만 수정할 수 있습니다.' })
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
          if (p.length < 4 || p.length > 100) {
            res.status(400).json({ message: '비밀번호는 4~100자여야 합니다.' })
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
      const curStatus = String(cur.status ?? 'active').toLowerCase()
      if (newStatus != null && newStatus !== curStatus) {
        setParts.push(`status = $${n++}`)
        vals.push(newStatus)
      }
      if (passwordUpdate != null) {
        setParts.push(`password_hash = $${n++}`)
        vals.push(await bcrypt.hash(passwordUpdate, 10))
        setParts.push(`delegate_password_plaintext = $${n++}`)
        vals.push(passwordUpdate)
      }
      if (setParts.length > 0) {
        vals.push(targetId, actorGaId)
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

      const rowQ = await systemQuery(
        pool,
        `
        SELECT
          u.id,
          u.username,
          u.role,
          u.status,
          u.created_at,
          u.ga_id,
          u.display_name,
          u.delegate_password_plaintext,
          g.name AS ga_name,
          g.code AS ga_code
        FROM users u
        INNER JOIN ga_companies g ON g.id = u.ga_id
        WHERE u.id = $1
        `,
        [targetId],
      )
      res.json(mapGaDelegateRowForGaAdmin(rowQ.rows[0]))
    } catch (error) {
      if (error?.code === '23505') {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })
}
