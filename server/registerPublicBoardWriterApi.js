import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { safeQuery, systemQuery } from './utils/dbSafeQuery.js'
import { isSuperAdminRole } from './lib/rbacScope.js'
import { isGlobalContentScope } from './lib/newsletterBoardScope.js'
import { NEWSLETTER_BOARD_BY_SLUG_SQL } from './lib/newsletterBoardAdminSql.js'
import { insertDynamicBoardNewsletter } from './lib/dynamicBoardNewsletterWrite.js'

export const PUBLIC_BOARD_WRITER_JWT_KIND = 'PUBLIC_BOARD_WRITER'
const WRITER_TOKEN_EXPIRES_IN = '12h'

/**
 * @param {string} jwtSecret
 */
export function createRequirePublicBoardWriterAuth(jwtSecret) {
  return function requirePublicBoardWriterAuth(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    try {
      const decoded = jwt.verify(token, jwtSecret)
      if (decoded.kind !== PUBLIC_BOARD_WRITER_JWT_KIND) {
        res.status(401).json({ message: '공용 게시판 작성자 세션이 아닙니다.' })
        return
      }
      const writerId = String(decoded.writerId ?? decoded.sub ?? '').trim()
      if (!writerId) {
        res.status(401).json({ message: '유효하지 않은 작성자 세션입니다.' })
        return
      }
      req.publicBoardWriter = {
        id: writerId,
        loginId: typeof decoded.loginId === 'string' ? decoded.loginId : '',
      }
      next()
    } catch {
      res.status(401).json({ message: '로그인이 필요합니다.' })
    }
  }
}

function mapWriterRow(row) {
  return {
    id: String(row.id),
    loginId: String(row.login_id ?? ''),
    name: String(row.name ?? ''),
    isActive: Boolean(row.is_active),
    allowedBoardIds: Array.isArray(row.allowed_board_ids)
      ? row.allowed_board_ids.map((v) => String(v))
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
    lastLoginAt:
      row.last_login_at == null
        ? null
        : row.last_login_at instanceof Date
          ? row.last_login_at.toISOString()
          : String(row.last_login_at),
  }
}

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
  const requirePublicBoardWriterAuth = createRequirePublicBoardWriterAuth(jwtSecret)

  apiRouter.post('/public-board-writer/login', async (req, res) => {
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
        FROM public_board_writer_accounts
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
      await systemQuery(
        pool,
        `UPDATE public_board_writer_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id],
      )
      const token = jwt.sign(
        {
          kind: PUBLIC_BOARD_WRITER_JWT_KIND,
          writerId: String(row.id),
          loginId: String(row.login_id ?? ''),
          sub: String(row.id),
          role: 'PUBLIC_BOARD_WRITER',
        },
        jwtSecret,
        { expiresIn: WRITER_TOKEN_EXPIRES_IN },
      )
      res.json({ token, writer: mapWriterRow(row) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/public-board-writer/me', requirePublicBoardWriterAuth, async (req, res) => {
    try {
      const writerId = String(req.publicBoardWriter?.id ?? '')
      const r = await systemQuery(
        pool,
        `SELECT * FROM public_board_writer_accounts WHERE id = $1 AND is_active = true LIMIT 1`,
        [writerId],
      )
      if (r.rowCount === 0) {
        res.status(401).json({ message: '비활성화되었거나 존재하지 않는 계정입니다.' })
        return
      }
      res.json(mapWriterRow(r.rows[0]))
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/public-board-writers', requireAuth, async (req, res) => {
    try {
      if (!isSuperAdminRole(req.user?.role)) {
        res.status(403).json({ message: '공용 작성자 계정 관리 권한이 없습니다.' })
        return
      }
      const r = await systemQuery(
        pool,
        `SELECT id, login_id, name, is_active, allowed_board_ids, created_at, updated_at, last_login_at
         FROM public_board_writer_accounts
         ORDER BY created_at DESC`,
        [],
      )
      res.json(r.rows.map(mapWriterRow))
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/public-board-writers', requireAuth, async (req, res) => {
    try {
      if (!isSuperAdminRole(req.user?.role)) {
        res.status(403).json({ message: '공용 작성자 계정 관리 권한이 없습니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const loginId = String(body.loginId ?? '').trim()
      const password = String(body.password ?? '')
      const name = String(body.name ?? '').trim()
      if (!loginId || loginId.length < 3) {
        res.status(400).json({ message: '아이디는 3자 이상 입력해 주세요.' })
        return
      }
      if (!password || password.length < 8) {
        res.status(400).json({ message: '비밀번호는 8자 이상 입력해 주세요.' })
        return
      }
      const allowedBoardIds = Array.isArray(body.allowedBoardIds)
        ? body.allowedBoardIds.map((v) => String(v).trim()).filter(Boolean)
        : null
      const dupe = await systemQuery(
        pool,
        `SELECT id FROM public_board_writer_accounts WHERE LOWER(TRIM(login_id)) = LOWER(TRIM($1)) LIMIT 1`,
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
        INSERT INTO public_board_writer_accounts
          (id, login_id, password_hash, name, is_active, allowed_board_ids, created_by_user_id)
        VALUES ($1, $2, $3, $4, true, $5, $6)
        RETURNING *
        `,
        [id, loginId, passwordHash, name || loginId, allowedBoardIds, String(req.user?.id ?? '') || null],
      )
      res.status(201).json(mapWriterRow(ins.rows[0]))
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/admin/public-board-writers/:writerId', requireAuth, async (req, res) => {
    try {
      if (!isSuperAdminRole(req.user?.role)) {
        res.status(403).json({ message: '공용 작성자 계정 관리 권한이 없습니다.' })
        return
      }
      const writerId = String(req.params.writerId ?? '').trim()
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
      if (Array.isArray(body.allowedBoardIds)) {
        vals.push(body.allowedBoardIds.map((v) => String(v).trim()).filter(Boolean))
        sets.push(`allowed_board_ids = $${vals.length}`)
      }
      if (sets.length === 0) {
        res.status(400).json({ message: '변경할 항목이 없습니다.' })
        return
      }
      vals.push(writerId)
      const r = await systemQuery(
        pool,
        `UPDATE public_board_writer_accounts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`,
        vals,
      )
      if (r.rowCount === 0) {
        res.status(404).json({ message: '계정을 찾을 수 없습니다.' })
        return
      }
      res.json(mapWriterRow(r.rows[0]))
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  async function loadGlobalBoardForWriter(boardSlug, writerId) {
    const boardRes = await safeQuery(pool, NEWSLETTER_BOARD_BY_SLUG_SQL, [boardSlug])
    if (boardRes.rowCount === 0) {
      return { error: { status: 404, message: '소식지 메뉴를 찾을 수 없습니다.' } }
    }
    const board = boardRes.rows[0]
    if (!isGlobalContentScope(board.content_scope)) {
      return { error: { status: 403, message: '전체 공용 게시판만 작성할 수 있습니다.' } }
    }
    const writerRes = await systemQuery(
      pool,
      `SELECT allowed_board_ids FROM public_board_writer_accounts WHERE id = $1 AND is_active = true LIMIT 1`,
      [writerId],
    )
    if (writerRes.rowCount === 0) {
      return { error: { status: 401, message: '비활성화된 계정입니다.' } }
    }
    const allowed = writerRes.rows[0].allowed_board_ids
    if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(String(board.id))) {
      return { error: { status: 403, message: '이 게시판에 대한 작성 권한이 없습니다.' } }
    }
    return { board }
  }

  apiRouter.post(
    '/public-board-writer/boards/:boardSlug/newsletters',
    requirePublicBoardWriterAuth,
    async (req, res) => {
      try {
        const boardSlug = String(req.params.boardSlug ?? '').trim()
        const writerId = String(req.publicBoardWriter?.id ?? '')
        const loaded = await loadGlobalBoardForWriter(boardSlug, writerId)
        if (loaded.error) {
          res.status(loaded.error.status).json({ message: loaded.error.message })
          return
        }
        const body = req.body && typeof req.body === 'object' ? req.body : {}
        const bodyText = String(body.bodyText ?? '')
        const statusRaw = String(body.status ?? 'PUBLISHED').toUpperCase()
        const status = statusRaw === 'DRAFT' ? 'DRAFT' : 'PUBLISHED'
        const row = await insertDynamicBoardNewsletter(pool, {
          board: loaded.board,
          gaId: null,
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
    },
  )

  apiRouter.get('/public-board-writer/boards', requirePublicBoardWriterAuth, async (req, res) => {
    try {
      const writerId = String(req.publicBoardWriter?.id ?? '')
      const writerRes = await systemQuery(
        pool,
        `SELECT allowed_board_ids FROM public_board_writer_accounts WHERE id = $1 AND is_active = true LIMIT 1`,
        [writerId],
      )
      if (writerRes.rowCount === 0) {
        res.status(401).json({ message: '비활성화된 계정입니다.' })
        return
      }
      const allowed = writerRes.rows[0].allowed_board_ids
      const boardsRes = await safeQuery(
        pool,
        `
        SELECT *
        FROM newsletter_boards
        WHERE is_deleted = false
          AND ga_id IS NULL
          AND content_scope = 'global'
        ORDER BY label ASC
        `,
        [],
      )
      let rows = boardsRes.rows
      if (Array.isArray(allowed) && allowed.length > 0) {
        const allowSet = new Set(allowed.map((v) => String(v)))
        rows = rows.filter((row) => allowSet.has(String(row.id)))
      }
      res.json(
        rows.map((row) => ({
          id: String(row.id),
          slug: String(row.slug),
          label: String(row.label),
        })),
      )
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
