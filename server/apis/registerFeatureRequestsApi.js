import {
  FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL,
  FEATURE_REQUEST_COMMENT_INSERT_SQL,
  FEATURE_REQUEST_COMMENT_SELECT_SQL,
} from '../lib/featureRequestCommentsSql.js'

const FEATURE_REQUEST_STATUSES = ['pending', 'reviewed', 'done']
const FEATURE_REQUEST_COMMENT_MAX_LEN = 4000

function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value ?? '')
  }

  return parsed.toISOString()
}

function mapFeatureRequestCommentRow(row) {
  const authorDisplayName = String(row.author_display_name ?? '').trim()
  const authorGaName = String(row.author_ga_name ?? '').trim()
  const authorUsername = row.author_username != null ? String(row.author_username) : null
  return {
    id: row.id,
    authorRole: row.author_role,
    authorUsername,
    authorDisplayName: authorDisplayName || authorUsername,
    authorGaName: authorGaName || null,
    authorId: row.author_user_id,
    createdAt: toIsoString(row.created_at),
    content: row.content,
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   safeQuery: Function,
 *   requireAuth: Function,
 *   requireSuperAdmin: Function,
 *   handleDbError: Function,
 *   parseGaId: Function,
 * }} deps
 */
export function registerFeatureRequestsApi(apiRouter, deps) {
  const { pool, safeQuery, requireAuth, requireSuperAdmin, handleDbError, parseGaId } = deps

  async function loadFeatureRequestGaIdForAdmin(requestId) {
    const own = await safeQuery(pool, `SELECT ga_id FROM feature_requests WHERE id = $1`, [requestId])
    if (own.rowCount === 0) {
      return null
    }
    return parseGaId(own.rows[0].ga_id)
  }

  apiRouter.post('/feature-request', requireAuth, async (req, res) => {
    try {
      const gaId = parseGaId(req.user?.gaId)
      const userId = req.user?.id
      if (gaId == null || !userId) {
        res.status(400).json({ message: '세션 정보가 올바르지 않습니다.' })
        return
      }
      const content = String(req.body?.content ?? '').trim()
      if (!content) {
        res.status(400).json({ message: '내용을 입력해 주세요.' })
        return
      }
      if (content.length > 8000) {
        res.status(400).json({ message: '내용은 8000자 이하로 입력해 주세요.' })
        return
      }
      let title = String(req.body?.title ?? '').trim()
      if (title.length > 200) {
        res.status(400).json({ message: '제목은 200자 이하로 입력해 주세요.' })
        return
      }
      if (!title) {
        title = content.length > 120 ? `${content.slice(0, 117)}...` : content
      }
      const ins = await safeQuery(
        pool,
        `
      INSERT INTO feature_requests (ga_id, user_id, title, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
      `,
        [gaId, userId, title, content],
      )
      res.status(201).json({
        id: ins.rows[0].id,
        created_at: toIsoString(ins.rows[0].created_at),
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/feature-requests/my', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id
      const gaId = parseGaId(req.user?.gaId)
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const r = await safeQuery(
        pool,
        `
      SELECT
        fr.id,
        fr.title,
        fr.content,
        fr.status,
        fr.created_at,
        (
          ${FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL}
        )::int AS comment_count
      FROM feature_requests fr
      WHERE fr.user_id = $1 AND fr.ga_id = $2
      ORDER BY fr.created_at DESC
      LIMIT 200
      `,
        [userId, gaId],
      )
      const rows = r.rows.map((row) => ({
        id: row.id,
        title: String(row.title ?? ''),
        content: row.content,
        status: row.status,
        created_at: toIsoString(row.created_at),
        comment_count: Number(row.comment_count ?? 0),
      }))
      res.json(rows)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/feature-requests/my/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: '잘못된 ID입니다.' })
        return
      }
      const userId = req.user?.id
      const gaId = parseGaId(req.user?.gaId)
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const del = await safeQuery(
        pool,
        `
      DELETE FROM feature_requests
      WHERE id = $1 AND user_id = $2 AND ga_id = $3
      `,
        [id, userId, gaId],
      )
      if (del.rowCount === 0) {
        res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
        return
      }
      res.status(204).send()
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/admin/feature-requests', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const r = await safeQuery(
        pool,
        `
      SELECT
        fr.id,
        fr.ga_id,
        g.name AS ga_name,
        u.username,
        COALESCE(NULLIF(TRIM(u.display_name), ''), NULLIF(TRIM(u.name), ''), '') AS user_name,
        COALESCE(fr.title, '') AS title,
        fr.content,
        fr.status,
        fr.created_at,
        (
          ${FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL}
        )::int AS comment_count
      FROM feature_requests fr
      INNER JOIN ga_companies g ON g.id = fr.ga_id
      INNER JOIN users u ON u.id = fr.user_id
      ORDER BY fr.created_at DESC
      LIMIT 500
      `,
        [],
      )
      const rows = r.rows.map((row) => ({
        id: row.id,
        ga_id: row.ga_id,
        ga_name: row.ga_name,
        username: row.username,
        user_name: String(row.user_name ?? ''),
        title: String(row.title ?? ''),
        content: row.content,
        status: row.status,
        created_at: toIsoString(row.created_at),
        comment_count: Number(row.comment_count ?? 0),
      }))
      res.json(rows)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/admin/feature-requests/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: '잘못된 ID입니다.' })
        return
      }
      const status = String(req.body?.status ?? '').trim()
      if (!FEATURE_REQUEST_STATUSES.includes(status)) {
        res.status(400).json({ message: 'status는 pending, reviewed, done 중 하나여야 합니다.' })
        return
      }
      const upd = await safeQuery(
        pool,
        `
      UPDATE feature_requests
      SET status = $1
      WHERE id = $2
      RETURNING id, ga_id, user_id, title, content, status, created_at
      `,
        [status, id],
      )
      if (upd.rowCount === 0) {
        res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
        return
      }
      const row = upd.rows[0]
      res.json({
        id: row.id,
        ga_id: row.ga_id,
        user_id: row.user_id,
        title: String(row.title ?? ''),
        content: row.content,
        status: row.status,
        created_at: toIsoString(row.created_at),
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/feature-requests/my/:id/comments', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: '잘못된 ID입니다.' })
        return
      }
      const userId = req.user?.id
      const gaId = parseGaId(req.user?.gaId)
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const own = await safeQuery(
        pool,
        `SELECT 1 FROM feature_requests WHERE id = $1 AND user_id = $2 AND ga_id = $3`,
        [id, userId, gaId],
      )
      if (own.rowCount === 0) {
        res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
        return
      }
      const r = await safeQuery(pool, FEATURE_REQUEST_COMMENT_SELECT_SQL, [id, gaId])
      res.json(r.rows.map(mapFeatureRequestCommentRow))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get(
    '/admin/feature-requests/:id/comments',
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const id = Number(req.params.id)
        if (!Number.isInteger(id) || id < 1) {
          res.status(400).json({ message: '잘못된 ID입니다.' })
          return
        }
        const requestGaId = await loadFeatureRequestGaIdForAdmin(id)
        if (requestGaId == null) {
          res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
          return
        }
        const r = await safeQuery(pool, FEATURE_REQUEST_COMMENT_SELECT_SQL, [id, requestGaId])
        res.json(r.rows.map(mapFeatureRequestCommentRow))
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )

  apiRouter.post(
    '/admin/feature-requests/:id/comments',
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const id = Number(req.params.id)
        if (!Number.isInteger(id) || id < 1) {
          res.status(400).json({ message: '잘못된 ID입니다.' })
          return
        }
        const rawContent = String(req.body?.content ?? '').trim()
        if (!rawContent) {
          res.status(400).json({ message: '내용을 입력해 주세요.' })
          return
        }
        if (rawContent.length > FEATURE_REQUEST_COMMENT_MAX_LEN) {
          res.status(400).json({
            message: `내용은 ${FEATURE_REQUEST_COMMENT_MAX_LEN}자 이하로 입력해 주세요.`,
          })
          return
        }
        const actorId = req.user?.id
        const actorUsername =
          String(req.user?.displayName ?? '').trim() ||
          String(req.user?.username ?? '').trim() ||
          null
        if (!actorId) {
          res.status(401).json({ message: '로그인이 필요합니다.' })
          return
        }
        const requestGaId = await loadFeatureRequestGaIdForAdmin(id)
        if (requestGaId == null) {
          res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
          return
        }
        const ins = await safeQuery(pool, FEATURE_REQUEST_COMMENT_INSERT_SQL, [
          id,
          actorId,
          actorUsername,
          rawContent,
          requestGaId,
        ])
        if (ins.rowCount === 0) {
          res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
          return
        }
        const inserted = ins.rows[0]
        const detail = await safeQuery(pool, FEATURE_REQUEST_COMMENT_SELECT_SQL, [id, requestGaId])
        const created =
          detail.rows.find((row) => Number(row.id) === Number(inserted.id)) ?? inserted
        res.status(201).json(mapFeatureRequestCommentRow(created))
      } catch (error) {
        console.error('[feature-request-comment] insert failed', {
          message: error?.message,
          code: error?.code,
          detail: error?.detail,
          requestId: req.params?.id,
          actorId: req.user?.id,
        })
        handleDbError(error, req, res)
      }
    },
  )
}
