import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'

const DEFAULT_WIDTH = 260
const DEFAULT_HEIGHT = 200
const DEFAULT_FONT_SIZE = 16
const DEFAULT_FONT_WEIGHT = 'normal'
const DEFAULT_Z_INDEX = 0

function normalizeFontWeight(value) {
  return value === 'bold' ? 'bold' : 'normal'
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapMemoRow(row) {
  return {
    id: String(row.id),
    content: row.content ?? '',
    x: Number(row.x),
    y: Number(row.y),
    width:
      row.width != null && Number.isFinite(Number(row.width))
        ? Math.round(Number(row.width))
        : DEFAULT_WIDTH,
    height:
      row.height != null && Number.isFinite(Number(row.height))
        ? Math.round(Number(row.height))
        : DEFAULT_HEIGHT,
    zIndex:
      row.z_index != null && Number.isFinite(Number(row.z_index))
        ? Math.round(Number(row.z_index))
        : DEFAULT_Z_INDEX,
    fontSize:
      row.font_size != null && Number.isFinite(Number(row.font_size))
        ? Math.round(Number(row.font_size))
        : DEFAULT_FONT_SIZE,
    fontWeight: normalizeFontWeight(row.font_weight),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

/**
 * requireAuth 이후 req.gaId 설정됨. SUPER_ADMIN 등 GA 없으면 null.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {number | null}
 */
function resolveTenantGaId(req, res) {
  const gid = parseGaId(req.gaId ?? req.user?.gaId)
  if (gid == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return gid
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
      const gaId = resolveTenantGaId(req, res)
      if (gaId == null) {
        return
      }
      const r = await safeQuery(
        pool,
        `
        SELECT id, content, x, y, width, height, z_index, font_size, font_weight, created_at, updated_at
        FROM memo
        WHERE user_id = $1 AND ga_id = $2
        ORDER BY updated_at DESC, created_at DESC
        `,
        [userId, gaId],
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
      const gaId = resolveTenantGaId(req, res)
      if (gaId == null) {
        return
      }
      const { content, x, y, width, height, zIndex, fontSize, fontWeight } = req.body ?? {}
      const contentVal = typeof content === 'string' ? content : ''
      const xVal = Number.isFinite(Number(x)) ? Math.round(Number(x)) : 100
      const yVal = Number.isFinite(Number(y)) ? Math.round(Number(y)) : 100
      const wVal =
        width !== undefined && width !== null && Number.isFinite(Number(width))
          ? Math.round(Number(width))
          : DEFAULT_WIDTH
      const hVal =
        height !== undefined && height !== null && Number.isFinite(Number(height))
          ? Math.round(Number(height))
          : DEFAULT_HEIGHT
      const zVal =
        zIndex !== undefined && zIndex !== null && Number.isFinite(Number(zIndex))
          ? Math.round(Number(zIndex))
          : DEFAULT_Z_INDEX
      const fVal =
        fontSize !== undefined && fontSize !== null && Number.isFinite(Number(fontSize))
          ? Math.round(Number(fontSize))
          : DEFAULT_FONT_SIZE
      const fwVal =
        fontWeight !== undefined && fontWeight !== null
          ? normalizeFontWeight(fontWeight)
          : DEFAULT_FONT_WEIGHT
      const r = await safeQuery(
        pool,
        `
        INSERT INTO memo (user_id, ga_id, content, x, y, width, height, z_index, font_size, font_weight)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, content, x, y, width, height, z_index, font_size, font_weight, created_at, updated_at
        `,
        [userId, gaId, contentVal, xVal, yVal, wVal, hVal, zVal, fVal, fwVal],
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
      const gaId = resolveTenantGaId(req, res)
      if (gaId == null) {
        return
      }
      const memoId = String(req.params.id ?? '').trim()
      if (!memoId) {
        res.status(400).json({ message: '메모 ID가 필요합니다.' })
        return
      }
      const cur = await safeQuery(
        pool,
        `SELECT id, content, x, y, width, height, z_index, font_size, font_weight FROM memo WHERE id = $1::uuid AND user_id = $2 AND ga_id = $3`,
        [memoId, userId, gaId],
      )
      if (cur.rowCount === 0) {
        res.status(404).json({ message: '메모를 찾을 수 없습니다.' })
        return
      }
      const row = cur.rows[0]
      const { content, x, y, width, height, zIndex, fontSize, fontWeight } = req.body ?? {}
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
      const nextWidth =
        width !== undefined && width !== null && Number.isFinite(Number(width))
          ? Math.round(Number(width))
          : row.width != null
            ? Math.round(Number(row.width))
            : DEFAULT_WIDTH
      const nextHeight =
        height !== undefined && height !== null && Number.isFinite(Number(height))
          ? Math.round(Number(height))
          : row.height != null
            ? Math.round(Number(row.height))
            : DEFAULT_HEIGHT
      const nextZIndex =
        zIndex !== undefined && zIndex !== null && Number.isFinite(Number(zIndex))
          ? Math.round(Number(zIndex))
          : row.z_index != null
            ? Math.round(Number(row.z_index))
            : DEFAULT_Z_INDEX
      const nextFontSize =
        fontSize !== undefined && fontSize !== null && Number.isFinite(Number(fontSize))
          ? Math.round(Number(fontSize))
          : row.font_size != null
            ? Math.round(Number(row.font_size))
            : DEFAULT_FONT_SIZE
      const nextFontWeight =
        fontWeight !== undefined && fontWeight !== null
          ? normalizeFontWeight(fontWeight)
          : row.font_weight != null
            ? normalizeFontWeight(row.font_weight)
            : DEFAULT_FONT_WEIGHT
      const up = await safeQuery(
        pool,
        `
        UPDATE memo
        SET content = $1, x = $2, y = $3, width = $4, height = $5, z_index = $6, font_size = $7, font_weight = $8, updated_at = NOW()
        WHERE id = $9::uuid AND user_id = $10 AND ga_id = $11
        RETURNING id, content, x, y, width, height, z_index, font_size, font_weight, created_at, updated_at
        `,
        [
          nextContent,
          nextX,
          nextY,
          nextWidth,
          nextHeight,
          nextZIndex,
          nextFontSize,
          nextFontWeight,
          memoId,
          userId,
          gaId,
        ],
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
      const gaId = resolveTenantGaId(req, res)
      if (gaId == null) {
        return
      }
      const memoId = String(req.params.id ?? '').trim()
      if (!memoId) {
        res.status(400).json({ message: '메모 ID가 필요합니다.' })
        return
      }
      const r = await safeQuery(
        pool,
        `DELETE FROM memo WHERE id = $1::uuid AND user_id = $2 AND ga_id = $3`,
        [memoId, userId, gaId],
      )
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
