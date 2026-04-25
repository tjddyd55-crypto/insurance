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
  'customer_app_messages',
  'agent_customer_messages',
  'customer_messages',
  'customer_newsletters',
  'newsletters',
  'insurer_newsletters',
]

const CUSTOMER_NEWS_OWNER_COLUMNS = [
  'agent_id',
  'user_id',
  'created_by_user_id',
  'created_by_id',
  'created_by',
  'author_id',
  'owner_id',
]

const CUSTOMER_NEWS_TARGET_COLUMNS = ['target_customer_id', 'customer_id', 'recipient_customer_id', 'target_id']

function parsePositiveIntLocal(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

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

async function deleteCustomerNewsChildRowsIfPresent(pool, newsId) {
  const childTables = [
    'customer_news_reads',
    'customer_news_attachments',
    'agent_customer_news_attachments',
    'customer_app_news_attachments',
  ]
  const childColumns = ['news_id', 'customer_news_id', 'customer_app_news_id', 'agent_customer_news_id']

  for (const tableName of childTables) {
    const columns = await loadTableColumns(pool, tableName)
    if (columns.size === 0) {
      continue
    }
    const fkColumn = pickFirstColumn(columns, childColumns)
    if (!fkColumn) {
      continue
    }
    await safeQuery(
      pool,
      `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(fkColumn)}::text = $1`,
      [newsId],
    )
  }
}

function buildDeleteAttempts(columns, context) {
  const ownerColumn = pickFirstColumn(columns, CUSTOMER_NEWS_OWNER_COLUMNS)
  const targetColumn = pickFirstColumn(columns, CUSTOMER_NEWS_TARGET_COLUMNS)
  const gaColumn = columns.has('ga_id') ? 'ga_id' : null
  const scopeColumn = columns.has('scope') ? 'scope' : null
  const attempts = []

  const addAttempt = (parts) => {
    const where = ['id::text = $1']
    const params = [context.newsId]
    for (const part of parts) {
      if (!part?.column || part.value == null || part.value === '') {
        continue
      }
      params.push(part.value)
      where.push(`${quoteIdentifier(part.column)}::text = $${params.length}`)
    }
    const key = where.join('|')
    if (!attempts.some((attempt) => attempt.key === key)) {
      attempts.push({ key, where, params })
    }
  }

  addAttempt([
    gaColumn ? { column: gaColumn, value: context.gaId } : null,
    ownerColumn ? { column: ownerColumn, value: context.userId } : null,
    targetColumn && context.targetCustomerId ? { column: targetColumn, value: context.targetCustomerId } : null,
    scopeColumn ? { column: scopeColumn, value: 'personal' } : null,
  ])
  addAttempt([
    gaColumn ? { column: gaColumn, value: context.gaId } : null,
    ownerColumn ? { column: ownerColumn, value: context.userId } : null,
    targetColumn && context.targetCustomerId ? { column: targetColumn, value: context.targetCustomerId } : null,
  ])
  addAttempt([
    ownerColumn ? { column: ownerColumn, value: context.userId } : null,
    targetColumn && context.targetCustomerId ? { column: targetColumn, value: context.targetCustomerId } : null,
  ])
  addAttempt([
    gaColumn ? { column: gaColumn, value: context.gaId } : null,
    targetColumn && context.targetCustomerId ? { column: targetColumn, value: context.targetCustomerId } : null,
  ])
  addAttempt([targetColumn && context.targetCustomerId ? { column: targetColumn, value: context.targetCustomerId } : null])
  addAttempt([ownerColumn ? { column: ownerColumn, value: context.userId } : null])
  addAttempt([gaColumn ? { column: gaColumn, value: context.gaId } : null])

  return attempts
}

async function tryDeleteCustomerNewsFromTable(pool, tableName, columns, context) {
  if (!columns.has('id')) {
    return { matched: false, deleted: false }
  }

  const attempts = buildDeleteAttempts(columns, context)
  const tableSql = quoteIdentifier(tableName)

  for (const attempt of attempts) {
    const exists = await safeQuery(
      pool,
      `SELECT id FROM ${tableSql} WHERE ${attempt.where.join(' AND ')} LIMIT 1`,
      attempt.params,
    )
    if (exists.rowCount === 0) {
      continue
    }

    await deleteCustomerNewsChildRowsIfPresent(pool, context.newsId)
    const deleted = await safeQuery(pool, `DELETE FROM ${tableSql} WHERE ${attempt.where.join(' AND ')}`, attempt.params)
    if (deleted.rowCount > 0) {
      return { matched: true, deleted: true }
    }
    return { matched: true, deleted: false }
  }

  return { matched: true, deleted: false }
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
      if (!newsId || newsId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(newsId)) {
        res.status(400).json({ message: '삭제할 개인메시지를 찾을 수 없습니다.' })
        return
      }
      const targetCustomerId = parsePositiveIntLocal(req.query?.targetCustomerId)

      let anyTableMatched = false
      const context = { newsId, userId, gaId, targetCustomerId }
      for (const tableName of CUSTOMER_NEWS_TABLE_CANDIDATES) {
        const columns = await loadTableColumns(pool, tableName)
        if (columns.size === 0) {
          continue
        }
        const result = await tryDeleteCustomerNewsFromTable(pool, tableName, columns, context)
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
