import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { systemQuery } from './utils/dbSafeQuery.js'
import { isSuperAdminRole } from './lib/rbacScope.js'
import { createRequireBoardWriterAuth } from './lib/boardWriterAuth.js'
import {
  assertBoardAssignableToWriterScope,
  assertWriterBoardAccess,
  BOARD_WRITER_JWT_KIND,
  listAllowedBoardIdsForWriter,
  listBoardsForWriter,
  loadNewsletterBoardBySlug,
  loadNewsletterBoardBySlugForWriter,
  mapBoardWriterRow,
  replaceWriterBoardPermissions,
} from './lib/boardWriterService.js'
import {
  createBoardWriterNewsletter,
  deleteBoardWriterNewsletter,
  listBoardWriterNewsletters,
  loadBoardWriterNewsletterById,
  presignBoardWriterAttachment,
  resolveBoardWriterStorageGaCode,
  updateBoardWriterNewsletter,
} from './lib/boardWriterNewsletters.js'
import { fetchNewsletterLinkPreviewForApi } from './lib/newsletterLinkPreview.js'
import {
  assertAdminCanManageBoardWriters,
  authenticateBoardWriterCredentials,
  createWriterAccountForBoard,
  isWriterLoginIdTaken,
  listWriterAccountsForBoard,
  loadNewsletterBoardById,
  patchWriterAccountForBoard,
  resolveBoardWriterLandingPath,
  signBoardWriterSessionToken,
} from './lib/boardWriterAccountService.js'

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
 *   withTransaction: Function
 * }} ctx
 */
export function registerPublicBoardWriterApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError, jwtSecret, bcrypt: bcryptLib, withTransaction } = ctx
  const requireBoardWriterAuth = createRequireBoardWriterAuth(jwtSecret)

  async function loadBoardForWriter(req, res) {
    const boardSlug = String(req.params.boardSlug ?? '').trim()
    const writerId = String(req.boardWriter?.id ?? '')
    const board = await loadNewsletterBoardBySlugForWriter(pool, boardSlug, writerId)
    if (!board) {
      res.status(404).json({ message: '소식지를 찾을 수 없습니다.' })
      return null
    }
    if (board.is_active === false) {
      res.status(403).json({
        message: '현재 사용하지 않는 게시판에는 글을 등록할 수 없습니다.',
        code: 'NEWSLETTER_BOARD_INACTIVE',
      })
      return null
    }
    const access = await assertWriterBoardAccess(pool, writerId, board)
    if (!access.ok) {
      res.status(access.status).json({ message: access.message })
      return null
    }
    return { board, writer: access.writer }
  }

  function writerOwnerGaId(writer) {
    return writer.owner_ga_id == null ? null : Number(writer.owner_ga_id)
  }

  async function loginWriter(req, res) {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const loginId = String(body.loginId ?? body.username ?? '').trim()
      const password = String(body.password ?? '')
      const auth = await authenticateBoardWriterCredentials(pool, loginId, password, bcryptLib)
      if (!auth.ok) {
        res.status(auth.status).json({ message: auth.message })
        return
      }
      const redirectPath = await resolveBoardWriterLandingPath(pool, String(auth.row.id))
      const token = signBoardWriterSessionToken(auth.row, auth.allowedBoardIds, jwtSecret)
      res.json({
        token,
        writer: mapBoardWriterRow(auth.row, auth.allowedBoardIds),
        redirectPath,
      })
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

  async function fetchWriterLinkPreview(req, res) {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const url = String(body.url ?? '').trim()
      const payload = await fetchNewsletterLinkPreviewForApi(url)
      res.json(payload)
    } catch {
      res.json({ success: true, preview: null })
    }
  }

  apiRouter.post('/board-writer/link-preview', requireBoardWriterAuth, fetchWriterLinkPreview)
  apiRouter.post('/public-board-writer/link-preview', requireBoardWriterAuth, fetchWriterLinkPreview)

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

  async function listWriterNewsletters(req, res) {
    try {
      const loaded = await loadBoardForWriter(req, res)
      if (!loaded) {
        return
      }
      const rows = await listBoardWriterNewsletters(pool, loaded.board, writerOwnerGaId(loaded.writer))
      res.json(rows)
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  async function getWriterNewsletter(req, res) {
    try {
      const loaded = await loadBoardForWriter(req, res)
      if (!loaded) {
        return
      }
      const newsletterId = String(req.params.newsletterId ?? '').trim()
      const detail = await loadBoardWriterNewsletterById(
        pool,
        loaded.board,
        newsletterId,
        writerOwnerGaId(loaded.writer),
      )
      if (!detail) {
        res.status(404).json({ message: '소식을 찾을 수 없습니다.' })
        return
      }
      res.json(detail)
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  async function createWriterPost(req, res) {
    try {
      const loaded = await loadBoardForWriter(req, res)
      if (!loaded) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const bodyText = String(body.bodyText ?? '')
      const statusRaw = String(body.status ?? 'PUBLISHED').toUpperCase()
      const status = statusRaw === 'DRAFT' ? 'DRAFT' : 'PUBLISHED'
      const detail = await createBoardWriterNewsletter(pool, withTransaction, {
        board: loaded.board,
        writerId: String(loaded.writer.id),
        writerOwnerGaId: writerOwnerGaId(loaded.writer),
        bodyText,
        status,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        linkPreview: Object.prototype.hasOwnProperty.call(body, 'linkPreview')
          ? body.linkPreview
          : Object.prototype.hasOwnProperty.call(body, 'link_preview')
            ? body.link_preview
            : undefined,
      })
      res.status(201).json(detail)
    } catch (e) {
      if (e && typeof e === 'object' && 'httpStatus' in e && typeof e.httpStatus === 'number') {
        res.status(e.httpStatus).json({ message: e instanceof Error ? e.message : '요청을 처리할 수 없습니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  }

  async function patchWriterNewsletter(req, res) {
    try {
      const loaded = await loadBoardForWriter(req, res)
      if (!loaded) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const statusRaw = String(body.status ?? 'PUBLISHED').toUpperCase()
      const status = statusRaw === 'DRAFT' ? 'DRAFT' : 'PUBLISHED'
      const detail = await updateBoardWriterNewsletter(pool, withTransaction, {
        board: loaded.board,
        newsletterId: String(req.params.newsletterId ?? '').trim(),
        writerId: String(loaded.writer.id),
        writerOwnerGaId: writerOwnerGaId(loaded.writer),
        bodyText: String(body.bodyText ?? ''),
        status,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        linkPreview: Object.prototype.hasOwnProperty.call(body, 'linkPreview')
          ? body.linkPreview
          : Object.prototype.hasOwnProperty.call(body, 'link_preview')
            ? body.link_preview
            : undefined,
      })
      res.json(detail)
    } catch (e) {
      if (e && typeof e === 'object' && 'httpStatus' in e && typeof e.httpStatus === 'number') {
        res.status(e.httpStatus).json({ message: e instanceof Error ? e.message : '요청을 처리할 수 없습니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  }

  async function deleteWriterNewsletter(req, res) {
    try {
      const loaded = await loadBoardForWriter(req, res)
      if (!loaded) {
        return
      }
      await deleteBoardWriterNewsletter(pool, withTransaction, {
        board: loaded.board,
        newsletterId: String(req.params.newsletterId ?? '').trim(),
        writerId: String(loaded.writer.id),
        writerOwnerGaId: writerOwnerGaId(loaded.writer),
      })
      res.status(204).send()
    } catch (e) {
      if (e && typeof e === 'object' && 'httpStatus' in e && typeof e.httpStatus === 'number') {
        res.status(e.httpStatus).json({ message: e instanceof Error ? e.message : '요청을 처리할 수 없습니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  }

  async function presignWriterAttachment(req, res) {
    try {
      const loaded = await loadBoardForWriter(req, res)
      if (!loaded) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const gaCode = await resolveBoardWriterStorageGaCode(pool, loaded.board)
      const result = await presignBoardWriterAttachment(loaded.board, gaCode, {
        fileName: String(body.fileName ?? 'file'),
        contentType: String(body.contentType ?? 'application/octet-stream'),
        sizeBytes: Number(body.sizeBytes ?? body.size ?? 0),
      })
      res.json(result)
    } catch (e) {
      if (e && typeof e === 'object' && 'httpStatus' in e && typeof e.httpStatus === 'number') {
        res.status(e.httpStatus).json({ message: e instanceof Error ? e.message : '요청을 처리할 수 없습니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  }

  const writerNewsletterRoutes = [
    ['get', '/boards/:boardSlug/newsletters', listWriterNewsletters],
    ['get', '/boards/:boardSlug/newsletters/:newsletterId', getWriterNewsletter],
    ['post', '/boards/:boardSlug/newsletters', createWriterPost],
    ['patch', '/boards/:boardSlug/newsletters/:newsletterId', patchWriterNewsletter],
    ['delete', '/boards/:boardSlug/newsletters/:newsletterId', deleteWriterNewsletter],
    ['post', '/boards/:boardSlug/attachments/presign', presignWriterAttachment],
  ]
  for (const [method, path, handler] of writerNewsletterRoutes) {
    apiRouter[method](`/board-writer${path}`, requireBoardWriterAuth, handler)
    apiRouter[method](`/public-board-writer${path}`, requireBoardWriterAuth, handler)
  }

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
      if (boardIds.length === 0) {
        res.status(400).json({ message: '작성 권한을 부여할 공용 소식지를 1개 이상 선택해 주세요.' })
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
      await replaceWriterBoardPermissions(pool, id, boardIds)
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
      if (boardIds.length === 0) {
        res.status(400).json({ message: '작성 권한을 부여할 GA 소식지를 1개 이상 선택해 주세요.' })
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
      await replaceWriterBoardPermissions(pool, id, boardIds)
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

  async function loadBoardWriterAdminContext(req, res) {
    const boardId = String(req.params.boardId ?? '').trim()
    const board = await loadNewsletterBoardById(pool, boardId)
    const access = assertAdminCanManageBoardWriters(req.user, board)
    if (!access.ok) {
      res.status(access.status).json({ message: access.message })
      return null
    }
    return { board, boardId, ...access }
  }

  apiRouter.get('/admin/newsletter-boards/:boardId/writer-accounts', requireAuth, async (req, res) => {
    try {
      const ctx = await loadBoardWriterAdminContext(req, res)
      if (!ctx) {
        return
      }
      const rows = await listWriterAccountsForBoard(pool, ctx.boardId)
      res.json(rows)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/ga-admin/newsletter-boards/:boardId/writer-accounts', requireAuth, async (req, res) => {
    try {
      const ctx = await loadBoardWriterAdminContext(req, res)
      if (!ctx) {
        return
      }
      const rows = await listWriterAccountsForBoard(pool, ctx.boardId)
      res.json(rows)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  async function checkBoardWriterLoginId(req, res) {
    try {
      const ctx = await loadBoardWriterAdminContext(req, res)
      if (!ctx) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const loginId = String(body.loginId ?? req.query?.loginId ?? '').trim()
      if (!loginId) {
        res.status(400).json({ message: '아이디를 입력해 주세요.' })
        return
      }
      const taken = await isWriterLoginIdTaken(pool, loginId)
      res.json({ available: !taken, loginId })
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.post('/admin/newsletter-boards/:boardId/writer-accounts/check-login-id', requireAuth, checkBoardWriterLoginId)
  apiRouter.post('/ga-admin/newsletter-boards/:boardId/writer-accounts/check-login-id', requireAuth, checkBoardWriterLoginId)

  async function createBoardScopedWriter(req, res) {
    try {
      const ctx = await loadBoardWriterAdminContext(req, res)
      if (!ctx) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const created = await createWriterAccountForBoard(
        pool,
        {
          boardId: ctx.boardId,
          loginId: String(body.loginId ?? '').trim(),
          password: String(body.password ?? ''),
          displayName: String(body.displayName ?? body.name ?? body.authorName ?? '').trim(),
          organizationName: String(body.organizationName ?? body.companyName ?? '').trim(),
          isActive: body.isActive == null ? true : Boolean(body.isActive),
          writerScope: ctx.writerScope,
          ownerGaId: ctx.ownerGaId,
          createdByUserId: String(req.user?.id ?? '') || null,
        },
        bcryptLib,
      )
      if (!created.ok) {
        res.status(created.status).json({ message: created.message })
        return
      }
      res.status(201).json(mapBoardWriterRow(created.row, created.allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.post('/admin/newsletter-boards/:boardId/writer-accounts', requireAuth, createBoardScopedWriter)
  apiRouter.post('/ga-admin/newsletter-boards/:boardId/writer-accounts', requireAuth, createBoardScopedWriter)

  async function patchBoardScopedWriterPassword(req, res) {
    try {
      const ctx = await loadBoardWriterAdminContext(req, res)
      if (!ctx) {
        return
      }
      const accountId = String(req.params.accountId ?? '').trim()
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const password = String(body.password ?? '').trim()
      if (!password || password.length < 8) {
        res.status(400).json({ message: '비밀번호는 8자 이상 입력해 주세요.' })
        return
      }
      const patched = await patchWriterAccountForBoard(pool, accountId, ctx.boardId, { password }, bcryptLib)
      if (!patched.ok) {
        res.status(patched.status).json({ message: patched.message })
        return
      }
      res.json(mapBoardWriterRow(patched.row, patched.allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  async function patchBoardScopedWriterStatus(req, res) {
    try {
      const ctx = await loadBoardWriterAdminContext(req, res)
      if (!ctx) {
        return
      }
      const accountId = String(req.params.accountId ?? '').trim()
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      if (body.isActive == null) {
        res.status(400).json({ message: 'isActive 값이 필요합니다.' })
        return
      }
      const patched = await patchWriterAccountForBoard(
        pool,
        accountId,
        ctx.boardId,
        { isActive: Boolean(body.isActive) },
        bcryptLib,
      )
      if (!patched.ok) {
        res.status(patched.status).json({ message: patched.message })
        return
      }
      res.json(mapBoardWriterRow(patched.row, patched.allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  async function patchBoardScopedWriterProfile(req, res) {
    try {
      const ctx = await loadBoardWriterAdminContext(req, res)
      if (!ctx) {
        return
      }
      const accountId = String(req.params.accountId ?? '').trim()
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const patch = {}
      if (body.organizationName != null || body.companyName != null) {
        patch.organizationName = String(body.organizationName ?? body.companyName ?? '').trim()
      }
      if (body.displayName != null || body.name != null || body.authorName != null) {
        patch.displayName = String(body.displayName ?? body.name ?? body.authorName ?? '').trim()
      }
      if (body.loginId != null) {
        patch.loginId = String(body.loginId).trim()
      }
      if (body.password != null && String(body.password).trim()) {
        patch.password = String(body.password).trim()
      }
      if (body.isActive != null) {
        patch.isActive = Boolean(body.isActive)
      }
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ message: '수정할 항목이 없습니다.' })
        return
      }
      const patched = await patchWriterAccountForBoard(pool, accountId, ctx.boardId, patch, bcryptLib)
      if (!patched.ok) {
        res.status(patched.status).json({ message: patched.message })
        return
      }
      res.json(mapBoardWriterRow(patched.row, patched.allowedBoardIds))
    } catch (e) {
      handleDbError(e, req, res)
    }
  }

  apiRouter.patch(
    '/admin/newsletter-boards/:boardId/writer-accounts/:accountId',
    requireAuth,
    patchBoardScopedWriterProfile,
  )
  apiRouter.patch(
    '/ga-admin/newsletter-boards/:boardId/writer-accounts/:accountId',
    requireAuth,
    patchBoardScopedWriterProfile,
  )

  apiRouter.patch(
    '/admin/newsletter-boards/:boardId/writer-accounts/:accountId/password',
    requireAuth,
    patchBoardScopedWriterPassword,
  )
  apiRouter.patch(
    '/ga-admin/newsletter-boards/:boardId/writer-accounts/:accountId/password',
    requireAuth,
    patchBoardScopedWriterPassword,
  )
  apiRouter.patch(
    '/admin/newsletter-boards/:boardId/writer-accounts/:accountId/status',
    requireAuth,
    patchBoardScopedWriterStatus,
  )
  apiRouter.patch(
    '/ga-admin/newsletter-boards/:boardId/writer-accounts/:accountId/status',
    requireAuth,
    patchBoardScopedWriterStatus,
  )
}
