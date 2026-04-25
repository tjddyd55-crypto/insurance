import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'

function isInsurerManagerRole(role) {
  const normalized = String(role ?? '')
  return normalized === 'INSURER_MANAGER' || normalized === 'LOSS_ADJUSTER'
}

function requireGaForNotifications(req, res) {
  if (isInsurerManagerRole(req.user?.role)) {
    res.status(403).json({ message: '알림을 사용할 수 없는 계정입니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return gaId
}

const NOTIFICATIONS_LIST_LIMIT_DEFAULT = 20
const NOTIFICATIONS_LIST_LIMIT_MAX = 50

const CUSTOMER_NEWS_TABLE_CANDIDATES = [
  'customer_news',
  'agent_customer_news',
  'customer_app_news',
  'customer_newsletters',
  'newsletters',
  'insurer_newsletters',
]

function assertSafeIdentifier(name) {
  const s = String(name ?? '')
  if (!/^[a-z][a-z0-9_]*$/i.test(s)) {
    throw new Error(`허용되지 않는 DB 식별자입니다: ${s}`)
  }
  return s
}

function quoteIdentifier(name) {
  return `"${assertSafeIdentifier(name)}"`
}

async function loadTableColumns(pool, tableName) {
  const result = await safeQuery(
    pool,
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName],
  )
  return new Set(result.rows.map((row) => String(row.column_name)))
}

function pickFirstColumn(columns, candidates) {
  return candidates.find((column) => columns.has(column)) ?? null
}

async function deleteCustomerNewsReadsIfPresent(pool, newsId) {
  const columns = await loadTableColumns(pool, 'customer_news_reads')
  if (!columns.has('news_id')) {
    return
  }
  await safeQuery(pool, `DELETE FROM customer_news_reads WHERE news_id = $1::bigint`, [newsId])
}

async function tryDeleteCustomerNewsFromTable(pool, tableName, columns, newsId, userId, gaId) {
  if (!columns.has('id')) {
    return { matched: false, deleted: false }
  }

  const ownerColumn = pickFirstColumn(columns, ['agent_id', 'user_id', 'created_by_user_id', 'author_id'])
  const gaColumn = columns.has('ga_id') ? 'ga_id' : null
  const scopeColumn = columns.has('scope') ? 'scope' : null
  const deletedAtColumn = columns.has('deleted_at') ? 'deleted_at' : null
  const isDeletedColumn = columns.has('is_deleted') ? 'is_deleted' : null
  const statusColumn = columns.has('status') ? 'status' : null

  const where = [`id = $1::bigint`]
  const params = [newsId]

  if (gaColumn) {
    params.push(gaId)
    where.push(`${quoteIdentifier(gaColumn)} = $${params.length}`)
  }

  if (ownerColumn) {
    params.push(userId)
    where.push(`${quoteIdentifier(ownerColumn)} = $${params.length}`)
  }

  if (scopeColumn) {
    params.push('personal')
    where.push(`${quoteIdentifier(scopeColumn)} = $${params.length}`)
  }

  const tableSql = quoteIdentifier(tableName)
  const whereSql = where.join(' AND ')

  let sql
  if (deletedAtColumn) {
    sql = `UPDATE ${tableSql} SET ${quoteIdentifier(deletedAtColumn)} = NOW() WHERE ${whereSql}`
  } else if (isDeletedColumn) {
    sql = `UPDATE ${tableSql} SET ${quoteIdentifier(isDeletedColumn)} = true WHERE ${whereSql}`
  } else if (statusColumn) {
    sql = `UPDATE ${tableSql} SET ${quoteIdentifier(statusColumn)} = 'deleted' WHERE ${whereSql}`
  } else {
    await deleteCustomerNewsReadsIfPresent(pool, newsId)
    sql = `DELETE FROM ${tableSql} WHERE ${whereSql}`
  }

  const result = await safeQuery(pool, sql, params)
  return { matched: true, deleted: result.rowCount > 0 }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerNotificationsApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/notifications/unread-count', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaForNotifications(req, res)
      if (gaId == null) {
        return
      }
      const r = await safeQuery(
        pool,
        `
        SELECT COUNT(*)::bigint AS c
        FROM notifications
        WHERE user_id = $1 AND ga_id = $2 AND is_read = false
        `,
        [userId, gaId],
      )
      const row = r.rows[0]
      const count = row && row.c != null ? Number(row.c) : 0
      res.json({ count: Number.isFinite(count) ? count : 0 })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/notifications', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaForNotifications(req, res)
      if (gaId == null) {
        return
      }
      const limRaw = Number(req.query?.limit ?? NOTIFICATIONS_LIST_LIMIT_DEFAULT)
      const limit = Math.min(
        NOTIFICATIONS_LIST_LIMIT_MAX,
        Math.max(1, Number.isFinite(limRaw) ? Math.floor(limRaw) : NOTIFICATIONS_LIST_LIMIT_DEFAULT),
      )
      const r = await safeQuery(
        pool,
        `
        SELECT id, user_id, ga_id, team_id, type, reference_id, message, is_read, created_at
        FROM notifications
        WHERE user_id = $1 AND ga_id = $2
        ORDER BY created_at DESC
        LIMIT $3
        `,
        [userId, gaId, limit],
      )
      res.json({
        notifications: r.rows.map((row) => ({
          id: String(row.id),
          userId: String(row.user_id ?? ''),
          gaId: Number(row.ga_id),
          teamId: row.team_id != null ? String(row.team_id) : null,
          type: String(row.type ?? ''),
          referenceId: row.reference_id != null ? String(row.reference_id) : null,
          message: String(row.message ?? ''),
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        })),
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/notifications/:notificationId/read', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaForNotifications(req, res)
      if (gaId == null) {
        return
      }
      const nid = String(req.params.notificationId ?? '').trim()
      if (!nid || !/^\d+$/.test(nid)) {
        res.status(400).json({ message: '알림을 찾을 수 없습니다.' })
        return
      }
      const upd = await safeQuery(
        pool,
        `
        UPDATE notifications
        SET is_read = true
        WHERE id = $1::bigint AND user_id = $2 AND ga_id = $3
        `,
        [nid, userId, gaId],
      )
      if (upd.rowCount === 0) {
        res.status(404).json({ message: '알림을 찾을 수 없습니다.' })
        return
      }
      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/agent/customer-news/:newsId', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = parseGaId(req.user?.gaId)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const newsId = String(req.params.newsId ?? '').trim()
      if (!newsId || !/^\d+$/.test(newsId)) {
        res.status(400).json({ message: '삭제할 개인메시지를 찾을 수 없습니다.' })
        return
      }

      let anyTableMatched = false
      for (const tableName of CUSTOMER_NEWS_TABLE_CANDIDATES) {
        const columns = await loadTableColumns(pool, tableName)
        if (columns.size === 0) {
          continue
        }
        const result = await tryDeleteCustomerNewsFromTable(pool, tableName, columns, newsId, userId, gaId)
        anyTableMatched = anyTableMatched || result.matched
        if (result.deleted) {
          res.json({ success: true, data: { id: newsId } })
          return
        }
      }

      res.status(404).json({
        message: anyTableMatched
          ? '삭제할 개인메시지를 찾을 수 없습니다.'
          : '개인메시지 저장소를 찾을 수 없습니다.',
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
