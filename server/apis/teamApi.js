import { randomUUID } from 'node:crypto'
import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'

function isInsurerManagerRole(role) {
  return String(role ?? '') === 'INSURER_MANAGER'
}

function requireGaTenantForTeam(req, res) {
  if (isInsurerManagerRole(req.user?.role)) {
    res.status(403).json({ message: '팀 기능을 사용할 수 없는 계정입니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return gaId
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
async function loadUserTeamContext(pool, userId) {
  const r = await safeQuery(
    pool,
    `
    SELECT u.team_id, u.ga_id
    FROM users u
    WHERE u.id = $1 AND u.is_deleted = false
    LIMIT 1
    `,
    [userId],
  )
  if (r.rowCount === 0) {
    return null
  }
  const row = r.rows[0]
  return {
    teamId: row.team_id != null ? String(row.team_id) : null,
    gaId: row.ga_id != null ? Number(row.ga_id) : null,
  }
}

const TEAM_NAME_MAX = 120

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerTeamApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.post('/teams/create', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaTenantForTeam(req, res)
      if (gaId == null) {
        return
      }

      const ctxRow = await loadUserTeamContext(pool, userId)
      if (!ctxRow || ctxRow.gaId !== gaId) {
        res.status(403).json({ message: '사용자 정보를 확인할 수 없습니다.' })
        return
      }
      if (ctxRow.teamId) {
        res.status(409).json({ message: '이미 소속된 팀이 있습니다. 기존 팀을 정리한 뒤 다시 시도해 주세요.' })
        return
      }

      let name = String(req.body?.name ?? '').trim()
      if (!name) {
        name = '팀'
      }
      if (name.length > TEAM_NAME_MAX) {
        res.status(400).json({ message: `팀 이름은 ${TEAM_NAME_MAX}자 이하로 입력해 주세요.` })
        return
      }

      const teamId = randomUUID()
      await client.query('BEGIN')
      await client.query(
        `
        INSERT INTO teams (id, ga_id, name)
        VALUES ($1, $2, $3)
        `,
        [teamId, gaId, name],
      )
      const upd = await client.query(
        `
        UPDATE users
        SET team_id = $1
        WHERE id = $2 AND ga_id = $3 AND is_deleted = false AND team_id IS NULL
        `,
        [teamId, userId, gaId],
      )
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(409).json({ message: '팀을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.' })
        return
      }
      await client.query('COMMIT')
      res.status(201).json({ teamId, name, gaId })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(error, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/teams/join', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaTenantForTeam(req, res)
      if (gaId == null) {
        return
      }
      const teamIdRaw = req.body?.teamId ?? req.body?.team_id
      const teamId = String(teamIdRaw ?? '').trim()
      if (!teamId) {
        res.status(400).json({ message: '팀 ID를 입력해 주세요.' })
        return
      }

      const teamRes = await safeQuery(
        pool,
        `SELECT id, ga_id, name FROM teams WHERE id = $1 LIMIT 1`,
        [teamId],
      )
      if (teamRes.rowCount === 0) {
        res.status(404).json({ message: '팀을 찾을 수 없습니다.' })
        return
      }
      const team = teamRes.rows[0]
      const teamGaId = Number(team.ga_id)
      if (!Number.isFinite(teamGaId) || teamGaId !== gaId) {
        res.status(403).json({ message: '이 GA에서 참여할 수 없는 팀입니다.' })
        return
      }

      const me = await loadUserTeamContext(pool, userId)
      if (!me || me.gaId !== gaId) {
        res.status(403).json({ message: '사용자 정보를 확인할 수 없습니다.' })
        return
      }
      if (me.teamId === teamId) {
        res.json({ ok: true, teamId, name: String(team.name ?? ''), gaId })
        return
      }

      const upd = await safeQuery(
        pool,
        `
        UPDATE users
        SET team_id = $1
        WHERE id = $2 AND ga_id = $3 AND is_deleted = false
        `,
        [teamId, userId, gaId],
      )
      if (upd.rowCount === 0) {
        res.status(409).json({ message: '팀 참여에 실패했습니다.' })
        return
      }
      res.json({ ok: true, teamId, name: String(team.name ?? ''), gaId })
    } catch (error) {
      handleDbError(error, res)
    }
  })

  apiRouter.get('/teams/members', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaTenantForTeam(req, res)
      if (gaId == null) {
        return
      }

      const me = await loadUserTeamContext(pool, userId)
      if (!me || me.gaId !== gaId) {
        res.status(403).json({ message: '사용자 정보를 확인할 수 없습니다.' })
        return
      }
      if (!me.teamId) {
        res.json({ teamId: null, teamName: null, members: [] })
        return
      }

      const teamRes = await safeQuery(
        pool,
        `SELECT id, name, ga_id FROM teams WHERE id = $1 LIMIT 1`,
        [me.teamId],
      )
      if (teamRes.rowCount === 0) {
        res.json({ teamId: me.teamId, teamName: null, members: [] })
        return
      }
      const teamRow = teamRes.rows[0]
      const resourceGaId = Number(teamRow.ga_id)
      if (!Number.isFinite(resourceGaId) || resourceGaId !== gaId) {
        res.status(403).json({ message: '팀 정보가 GA와 일치하지 않습니다.' })
        return
      }

      const members = await safeQuery(
        pool,
        `
        SELECT id, username, display_name, role, team_id
        FROM users
        WHERE team_id = $1 AND ga_id = $2 AND is_deleted = false
        ORDER BY display_name ASC NULLS LAST, username ASC
        `,
        [me.teamId, gaId],
      )
      res.json({
        teamId: String(teamRow.id),
        teamName: String(teamRow.name ?? ''),
        members: members.rows.map((row) => ({
          userId: String(row.id),
          username: String(row.username ?? ''),
          displayName: String(row.display_name ?? ''),
          role: String(row.role ?? ''),
          teamId: row.team_id != null ? String(row.team_id) : null,
        })),
      })
    } catch (error) {
      handleDbError(error, res)
    }
  })
}
