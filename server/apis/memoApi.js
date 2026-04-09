import { safeQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapMemoRow(row) {
  return {
    id: String(row.id),
    content: row.content ?? '',
    x: Number(row.x),
    y: Number(row.y),
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerMemoApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/memo', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const r = await safeQuery(
        pool,
        `
        SELECT id, content, x, y, created_at, updated_at
        FROM memo
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [userId],
      )
      res.json(r.rows.map(mapMemoRow))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/memo', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const { content, x, y } = req.body ?? {}
      const contentVal = typeof content === 'string' ? content : ''
      const xVal = Number.isFinite(Number(x)) ? Math.round(Number(x)) : 100
      const yVal = Number.isFinite(Number(y)) ? Math.round(Number(y)) : 100
      const r = await safeQuery(
        pool,
        `
        INSERT INTO memo (user_id, content, x, y)
        VALUES ($1, $2, $3, $4)
        RETURNING id, content, x, y
        `,
        [userId, contentVal, xVal, yVal],
      )
      if (r.rowCount === 0) {
        res.status(500).json({ message: '메모를 생성하지 못했습니다.' })
        return
      }
      res.status(201).json(mapMemoRow(r.rows[0]))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.put('/memo/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const memoId = String(req.params.id ?? '').trim()
      if (!memoId) {
        res.status(400).json({ message: '메모 ID가 필요합니다.' })
        return
      }
      const cur = await safeQuery(
        pool,
        `SELECT id, content, x, y FROM memo WHERE id = $1::uuid AND user_id = $2`,
        [memoId, userId],
      )
      if (cur.rowCount === 0) {
        res.status(404).json({ message: '메모를 찾을 수 없습니다.' })
        return
      }
      const row = cur.rows[0]
      const { content, x, y } = req.body ?? {}
      const nextContent =
        content !== undefined && content !== null ? String(content) : String(row.content ?? '')
      const nextX =
        x !== undefined && x !== null && Number.isFinite(Number(x))
          ? Math.round(Number(x))
          : Number(row.x)
      const nextY =
        y !== undefined && y !== null && Number.isFinite(Number(y))
          ? Math.round(Number(y))
          : Number(row.y)
      const up = await safeQuery(
        pool,
        `
        UPDATE memo
        SET content = $1, x = $2, y = $3, updated_at = NOW()
        WHERE id = $4::uuid AND user_id = $5
        RETURNING id, content, x, y
        `,
        [nextContent, nextX, nextY, memoId, userId],
      )
      if (up.rowCount === 0) {
        res.status(404).json({ message: '메모를 찾을 수 없습니다.' })
        return
      }
      res.json(mapMemoRow(up.rows[0]))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/memo/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const memoId = String(req.params.id ?? '').trim()
      if (!memoId) {
        res.status(400).json({ message: '메모 ID가 필요합니다.' })
        return
      }
      const r = await safeQuery(pool, `DELETE FROM memo WHERE id = $1::uuid AND user_id = $2`, [
        memoId,
        userId,
      ])
      if (r.rowCount === 0) {
        res.status(404).json({ message: '메모를 찾을 수 없습니다.' })
        return
      }
      res.json({ success: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
