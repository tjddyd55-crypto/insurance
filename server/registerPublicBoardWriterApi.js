import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { safeQuery, systemQuery } from './utils/dbSafeQuery.js'
import { isSuperAdminRole } from './lib/rbacScope.js'
import { createRequireBoardWriterAuth } from './lib/boardWriterAuth.js'
import {
  assertBoardAssignableToWriterScope,
  assertWriterBoardAccess,
  BOARD_WRITER_JWT_KIND,
  listAllowedBoardIdsForWriter,
  listBoardsForWriter,
  mapBoardWriterRow,
  replaceWriterBoardPermissions,
} from './lib/boardWriterService.js'
import { insertDynamicBoardNewsletter } from './lib/dynamicBoardNewsletterWrite.js'
import { NEWSLETTER_BOARD_BY_SLUG_SQL } from './lib/newsletterBoardAdminSql.js'

export { BOARD_WRITER_JWT_KIND, PUBLIC_BOARD_WRITER_JWT_KIND } from './lib/boardWriterService.js'
export { createRequirePublicBoardWriterAuth } from './lib/boardWriterAuth.js'

const WRITER_TOKEN_EXPIRES_IN = '12h'

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool
 *   requireAuth: Function
 *   handleDbError: Function
 *   jwtSecret: string
 *   bcrypt: typeof import('bcryptjs')
 * }} ctx
 */
export function registerPublicBoardWriterApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError, jwtSecret, bcrypt: bcryptLib } = ctx
  const requireBoardWriterAuth = createRequireBoardWriterAuth(jwtSecret)

  async function loginWriter(req, res) {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const loginId = String(body.loginId ?? body.username ?? '').trim()
      const password = String(body.password ?? '')
      if (!loginId || !password) {
        res.status(400).json({ message: '아이디와 비밀번호를 입력해 주세요.' })
        return
      }
      const r = await systemQuery(
        pool,
        `
        SELECT *
        FROM board_writer_accounts
        WHERE LOWER(TRIM(login_id)) = LOWER(TRIM($1))
          AND is_active = true
        LIMIT 1
        `,
        [loginId],
      )
      if (r.rowCount === 0) {
        res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
        return
      }
      const row = r.rows[0]
      const match = await bcryptLib.compare(password, String(row.password_hash ?? ''))
      if (!match) {
        res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
        return
      }
      const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, String(row.id))
      await systemQuery(
        pool,
        `UPDATE board_writer_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id],
      )
      const token = jwt.sign(
        {
          kind: BOARD_WRITER_JWT_KIND,
          writerAccountId: String(row.id),
          writerId: String(row.id),
          loginId: String(row.login_id ?? ''),
          writerScope: String(row.writer_scope ?? 'global'),
          ownerGaId: row.owner_ga_id == null ? null : Number(row.owner_ga_id),
          allowedBoardIds,
          sub: String(row.id),
          role: 'BOARD_WRITER',
        },
        jwtSecret,
        { expiresIn: WRITER_TOKEN_EXPIRES_IN },
      )
      res.json({ token, writer: mapBoardWriterRow(row, allowedBoardIds) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.post('/board-writer/login', loginWriter)
  apiRouter.post('/public-board-writer/login', loginWriter)

  async function getWriterMe(req, res) {
    try {
      const writerId = String(req.boardWriter?.id ?? '')
      const r = await systemQuery(
        pool,
        `SELECT * FROM board_writer_accounts WHERE id = $1 AND is_active = true LIMIT 1`,
        [writerId],
      )
      if (r.rowCount === 0) {
        res.status(401).json({ message: '비활성화되었거나 존재하지 않는 계정입니다.' })
        return
      }
      const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, writerId)
      res.json(mapBoardWriterRow(r.rows[0], allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.get('/board-writer/me', requireBoardWriterAuth, getWriterMe)
  apiRouter.get('/public-board-writer/me', requireBoardWriterAuth, getWriterMe)

  async function listWriterBoards(req, res) {
    try {
      const writerId = String(req.boardWriter?.id ?? '')
      const rows = await listBoardsForWriter(pool, writerId)
      res.json(
        rows.map((row) => ({
          id: String(row.id),
          slug: String(row.slug),
          label: String(row.label),
          boardScope: String(row.board_scope ?? 'global'),
        })),
      )
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.get('/board-writer/boards', requireBoardWriterAuth, listWriterBoards)
  apiRouter.get('/public-board-writer/boards', requireBoardWriterAuth, listWriterBoards)

  async function createWriterPost(req, res) {
    try {
      const boardSlug = String(req.params.boardSlug ?? '').trim()
      const writerId = String(req.boardWriter?.id ?? '')
      const boardRes = await safeQuery(pool, NEWSLETTER_BOARD_BY_SLUG_SQL, [boardSlug])
      if (boardRes.rowCount === 0) {
        res.status(404).json({ message: '게시판을 찾을 수 없습니다.' })
        return
      }
      const board = boardRes.rows[0]
      const access = await assertWriterBoardAccess(pool, writerId, board)
      if (!access.ok) {
        res.status(access.status).json({ message: access.message })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const bodyText = String(body.bodyText ?? '')
      const statusRaw = String(body.status ?? 'PUBLISHED').toUpperCase()
      const status = statusRaw === 'DRAFT' ? 'DRAFT' : 'PUBLISHED'
      const gaId =
        String(access.writer.writer_scope) === 'ga' ? Number(access.writer.owner_ga_id) : null
      const row = await insertDynamicBoardNewsletter(pool, {
        board,
        gaId,
        bodyText,
        status,
        publisherId: writerId,
      })
      res.status(201).json({
        id: String(row.id),
        status: String(row.status),
        bodyText: String(row.body_text ?? ''),
      })
    } catch (e) {
      if (e && typeof e === 'object' && 'httpStatus' in e && typeof e.httpStatus === 'number') {
        res.status(e.httpStatus).json({ message: e instanceof Error ? e.message : '요청을 처리할 수 없습니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  }

  apiRouter.post('/board-writer/boards/:boardSlug/newsletters', requireBoardWriterAuth, createWriterPost)
  apiRouter.post('/public-board-writer/boards/:boardSlug/newsletters', requireBoardWriterAuth, createWriterPost)

  apiRouter.get('/admin/board-writers', requireAuth, async (req, res) => {
    try {
      if (!isSuperAdminRole(req.user?.role)) {
        res.status(403).json({ message: '공용 작성자 관리 권한이 없습니다.' })
        return
      }
      const r = await systemQuery(
        pool,
        `SELECT * FROM board_writer_accounts WHERE writer_scope = 'global' ORDER BY created_at DESC`,
        [],
      )
      const rows = []
      for (const row of r.rows) {
        const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, String(row.id))
        rows.push(mapBoardWriterRow(row, allowedBoardIds))
      }
      res.json(rows)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/public-board-writers', requireAuth, async (req, res) => {
    if (!isSuperAdminRole(req.user?.role)) {
      res.status(403).json({ message: '공용 작성자 계정 관리 권한이 없습니다.' })
      return
    }
    try {
      const r = await systemQuery(
        pool,
        `SELECT * FROM board_writer_accounts WHERE writer_scope = 'global' ORDER BY created_at DESC`,
        [],
      )
      const rows = []
      for (const row of r.rows) {
        const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, String(row.id))
        rows.push(mapBoardWriterRow(row, allowedBoardIds))
      }
      res.json(rows)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  async function createGlobalWriter(req, res) {
    try {
      if (!isSuperAdminRole(req.user?.role)) {
        res.status(403).json({ message: '공용 작성자 계정 관리 권한이 없습니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const loginId = String(body.loginId ?? '').trim()
      const password = String(body.password ?? '')
      const name = String(body.name ?? '').trim()
      const boardIds = Array.isArray(body.allowedBoardIds)
        ? body.allowedBoardIds.map((v) => String(v).trim()).filter(Boolean)
        : []
      if (!loginId || loginId.length < 3) {
        res.status(400).json({ message: '아이디는 3자 이상 입력해 주세요.' })
        return
      }
      if (!password || password.length < 8) {
        res.status(400).json({ message: '비밀번호는 8자 이상 입력해 주세요.' })
        return
      }
      for (const boardId of boardIds) {
        const check = await assertBoardAssignableToWriterScope(pool, boardId, 'global', null)
        if (!check.ok) {
          res.status(400).json({ message: check.message })
          return
        }
      }
      const dupe = await systemQuery(
        pool,
        `SELECT id FROM board_writer_accounts WHERE LOWER(TRIM(login_id)) = LOWER(TRIM($1)) LIMIT 1`,
        [loginId],
      )
      if (dupe.rowCount > 0) {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
      const id = randomUUID()
      const passwordHash = await bcryptLib.hash(password, 10)
      const ins = await systemQuery(
        pool,
        `
        INSERT INTO board_writer_accounts
          (id, login_id, password_hash, name, writer_scope, owner_ga_id, is_active, created_by_user_id)
        VALUES ($1, $2, $3, $4, 'global', NULL, true, $5)
        RETURNING *
        `,
        [id, loginId, passwordHash, name || loginId, String(req.user?.id ?? '') || null],
      )
      if (boardIds.length > 0) {
        await replaceWriterBoardPermissions(pool, id, boardIds)
      }
      const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, id)
      res.status(201).json(mapBoardWriterRow(ins.rows[0], allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.post('/admin/board-writers', requireAuth, createGlobalWriter)
  apiRouter.post('/admin/public-board-writers', requireAuth, createGlobalWriter)

  async function patchWriter(req, res, writerScope, ownerGaId = null) {
    try {
      const writerId = String(req.params.writerId ?? '').trim()
      let checkSql = `SELECT * FROM board_writer_accounts WHERE id = $1 AND writer_scope = $2`
      const checkParams = [writerId, writerScope]
      if (ownerGaId != null) {
        checkSql += ` AND owner_ga_id = $3`
        checkParams.push(ownerGaId)
      } else {
        checkSql += ` AND owner_ga_id IS NULL`
      }
      checkSql += ` LIMIT 1`
      const existing = await systemQuery(pool, checkSql, checkParams)
      if (existing.rowCount === 0) {
        res.status(404).json({ message: '계정을 찾을 수 없습니다.' })
        return
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const sets = []
      const vals = []
      if (body.name != null) {
        vals.push(String(body.name).trim())
        sets.push(`name = $${vals.length}`)
      }
      if (body.isActive != null) {
        vals.push(Boolean(body.isActive))
        sets.push(`is_active = $${vals.length}`)
      }
      if (body.password != null && String(body.password).trim()) {
        vals.push(await bcryptLib.hash(String(body.password), 10))
        sets.push(`password_hash = $${vals.length}`)
      }
      if (sets.length > 0) {
        vals.push(writerId)
        await systemQuery(
          pool,
          `UPDATE board_writer_accounts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`,
          vals,
        )
      }
      if (Array.isArray(body.allowedBoardIds)) {
        const boardIds = body.allowedBoardIds.map((v) => String(v).trim()).filter(Boolean)
        for (const boardId of boardIds) {
          const check = await assertBoardAssignableToWriterScope(pool, boardId, writerScope, ownerGaId)
          if (!check.ok) {
            res.status(400).json({ message: check.message })
            return
          }
        }
        await replaceWriterBoardPermissions(pool, writerId, boardIds)
      }
      const rowRes = await systemQuery(
        pool,
        `SELECT * FROM board_writer_accounts WHERE id = $1 LIMIT 1`,
        [writerId],
      )
      const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, writerId)
      res.json(mapBoardWriterRow(rowRes.rows[0], allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.patch('/admin/board-writers/:writerId', requireAuth, async (req, res) => {
    if (!isSuperAdminRole(req.user?.role)) {
      res.status(403).json({ message: '공용 작성자 계정 관리 권한이 없습니다.' })
      return
    }
    await patchWriter(req, res, 'global', null)
  })

  apiRouter.patch('/admin/public-board-writers/:writerId', requireAuth, async (req, res) => {
    if (!isSuperAdminRole(req.user?.role)) {
      res.status(403).json({ message: '공용 작성자 계정 관리 권한이 없습니다.' })
      return
    }
    await patchWriter(req, res, 'global', null)
  })

  apiRouter.get('/ga-admin/board-writers', requireAuth, async (req, res) => {
    try {
      if (String(req.user?.role ?? '') !== 'GA_ADMIN') {
        res.status(403).json({ message: 'GA 관리자만 이용할 수 있습니다.' })
        return
      }
      const gaId = Number(req.user?.gaId)
      const r = await systemQuery(
        pool,
        `SELECT * FROM board_writer_accounts WHERE writer_scope = 'ga' AND owner_ga_id = $1 ORDER BY created_at DESC`,
        [gaId],
      )
      const rows = []
      for (const row of r.rows) {
        const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, String(row.id))
        rows.push(mapBoardWriterRow(row, allowedBoardIds))
      }
      res.json(rows)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/ga-admin/board-writers', requireAuth, async (req, res) => {
    try {
      if (String(req.user?.role ?? '') !== 'GA_ADMIN') {
        res.status(403).json({ message: 'GA 관리자만 이용할 수 있습니다.' })
        return
      }
      const gaId = Number(req.user?.gaId)
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const loginId = String(body.loginId ?? '').trim()
      const password = String(body.password ?? '')
      const name = String(body.name ?? '').trim()
      const boardIds = Array.isArray(body.allowedBoardIds)
        ? body.allowedBoardIds.map((v) => String(v).trim()).filter(Boolean)
        : []
      if (!loginId || loginId.length < 3) {
        res.status(400).json({ message: '아이디는 3자 이상 입력해 주세요.' })
        return
      }
      if (!password || password.length < 8) {
        res.status(400).json({ message: '비밀번호는 8자 이상 입력해 주세요.' })
        return
      }
      for (const boardId of boardIds) {
        const check = await assertBoardAssignableToWriterScope(pool, boardId, 'ga', gaId)
        if (!check.ok) {
          res.status(400).json({ message: check.message })
          return
        }
      }
      const dupe = await systemQuery(
        pool,
        `SELECT id FROM board_writer_accounts WHERE LOWER(TRIM(login_id)) = LOWER(TRIM($1)) LIMIT 1`,
        [loginId],
      )
      if (dupe.rowCount > 0) {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
      const id = randomUUID()
      const passwordHash = await bcryptLib.hash(password, 10)
      const ins = await systemQuery(
        pool,
        `
        INSERT INTO board_writer_accounts
          (id, login_id, password_hash, name, writer_scope, owner_ga_id, is_active, created_by_user_id)
        VALUES ($1, $2, $3, $4, 'ga', $5, true, $6)
        RETURNING *
        `,
        [id, loginId, passwordHash, name || loginId, gaId, String(req.user?.id ?? '') || null],
      )
      if (boardIds.length > 0) {
        await replaceWriterBoardPermissions(pool, id, boardIds)
      }
      const allowedBoardIds = await listAllowedBoardIdsForWriter(pool, id)
      res.status(201).json(mapBoardWriterRow(ins.rows[0], allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/ga-admin/board-writers/:writerId', requireAuth, async (req, res) => {
    if (String(req.user?.role ?? '') !== 'GA_ADMIN') {
      res.status(403).json({ message: 'GA 관리자만 이용할 수 있습니다.' })
      return
    }
    await patchWriter(req, res, 'ga', Number(req.user?.gaId))
  })
}
