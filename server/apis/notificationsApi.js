import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { deleteCustomerNewsletter } from '../services/customerNewsDeleteService.js'
import {
  getKstEndOfDayDate,
  mapUserNotificationRow,
  syncDueUserNotifications,
} from '../services/userNotificationService.js'
import {
  getDefaultUserNotificationSettings,
  getUserNotificationSettings,
  normalizeUserNotificationSettingsPatch,
  upsertUserNotificationSettings,
} from '../services/userNotificationSettingsService.js'
import { USER_NOTIFICATION_TYPES } from '../notifications/userNotificationTypes.js'
import { addDaysToDateOnly, getKstDateString } from '../../shared/dateTimeKst.js'

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

const NOTIFICATIONS_LIST_LIMIT_DEFAULT = 50
const NOTIFICATIONS_LIST_LIMIT_MAX = 100

const LEGACY_NOTIFICATION_SETTING_COLUMNS = [
  'customer_claim_message',
  'new_customer_registered',
  'insurer_news_uploaded',
  'car_renewal_one_month',
  'insurer_contact_updated',
  'modal_suppressed_until',
]

function mapLegacyNotificationSettingsRow(row) {
  return {
    customerClaimMessage: row?.customer_claim_message !== false,
    newCustomerRegistered: row?.new_customer_registered !== false,
    insurerNewsUploaded: row?.insurer_news_uploaded !== false,
    carRenewalOneMonth: row?.car_renewal_one_month !== false,
    insurerContactUpdated: row?.insurer_contact_updated !== false,
    modalSuppressedUntil: row?.modal_suppressed_until ?? null,
  }
}

function defaultLegacyNotificationSettingsRow() {
  return {
    customer_claim_message: true,
    new_customer_registered: true,
    insurer_news_uploaded: true,
    car_renewal_one_month: true,
    insurer_contact_updated: true,
    modal_suppressed_until: null,
  }
}

async function ensureLegacyNotificationSettings(pool, userId, gaId) {
  try {
    const r = await safeQuery(
      pool,
      `
      INSERT INTO notification_settings (user_id, ga_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, ga_id) DO UPDATE
      SET updated_at = notification_settings.updated_at
      RETURNING ${LEGACY_NOTIFICATION_SETTING_COLUMNS.join(', ')}
      `,
      [userId, gaId],
    )
    return r.rows[0] ?? defaultLegacyNotificationSettingsRow()
  } catch (error) {
    console.error('[notificationsApi] ensureLegacyNotificationSettings failed', { userId, gaId, error })
    return defaultLegacyNotificationSettingsRow()
  }
}

function parsePositiveIntLocal(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function parseNotificationListFilters(query) {
  const viewRaw = String(query?.view ?? '').trim().toLowerCase()
  const statusRaw = String(query?.status ?? '').trim().toLowerCase()
  const type = String(query?.type ?? 'all').trim().toLowerCase()
  const allowedViews = new Set(['active', 'confirmed'])
  const allowedStatus = new Set(['all', 'unread', 'read', 'dismissed', 'hidden'])
  const allowedTypes = new Set([
    'all',
    USER_NOTIFICATION_TYPES.CAR_EXPIRY,
    USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE,
    USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED,
    USER_NOTIFICATION_TYPES.SPECIAL_DATE,
    USER_NOTIFICATION_TYPES.CUSTOMER_CREATED,
  ])
  let view = 'active'
  if (allowedViews.has(viewRaw)) {
    view = viewRaw
  } else if (statusRaw === 'dismissed' || statusRaw === 'hidden') {
    view = 'confirmed'
  } else if (allowedStatus.has(statusRaw)) {
    view = 'active'
  }
  return {
    view,
    status: view === 'confirmed' ? 'dismissed' : 'all',
    type: allowedTypes.has(type) ? type : 'all',
  }
}

/**
 * @param {string} userId
 * @param {number} gaId
 * @param {{ view: string, type: string }} filters
 * @param {import('../services/userNotificationSettingsService.js').UserNotificationSettings} [settings]
 */
export function buildNotificationListWhere(
  userId,
  gaId,
  filters,
  settings = getDefaultUserNotificationSettings(),
) {
  const params = [userId, gaId]
  const parts = ['user_id = $1', 'ga_id = $2']
  if (filters.view === 'confirmed') {
    parts.push('is_dismissed = true')
    parts.push(`COALESCE(confirmed_at, created_at) >= NOW() - INTERVAL '1 month'`)
  } else {
    parts.push('is_dismissed = false')
    const today = getKstDateString()
    const typeClauses = []

    const pushWindowedType = (enabled, type, daysBefore) => {
      if (!enabled) {
        return
      }
      if (!today) {
        return
      }
      const upperBound = addDaysToDateOnly(today, daysBefore)
      if (!upperBound) {
        return
      }
      params.push(today)
      const todayParam = params.length
      params.push(upperBound)
      const upperParam = params.length
      typeClauses.push(
        `(type = '${type}' AND target_date >= $${todayParam}::date AND target_date <= $${upperParam}::date)`,
      )
    }

    pushWindowedType(
      settings.workAlert.enabled && settings.insuranceAge.enabled,
      USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE,
      settings.insuranceAge.daysBefore,
    )
    pushWindowedType(
      settings.workAlert.enabled && settings.carExpiry.enabled,
      USER_NOTIFICATION_TYPES.CAR_EXPIRY,
      settings.carExpiry.daysBefore,
    )
    pushWindowedType(
      settings.workAlert.enabled && settings.specialDate.enabled,
      USER_NOTIFICATION_TYPES.SPECIAL_DATE,
      settings.specialDate.daysBefore,
    )
    if (settings.claimRequest.enabled || settings.customerAppFile.enabled) {
      typeClauses.push(`(type = '${USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED}')`)
    }
    if (settings.newCustomer.enabled) {
      typeClauses.push(`(type = '${USER_NOTIFICATION_TYPES.CUSTOMER_CREATED}')`)
    }

    if (typeClauses.length === 0) {
      parts.push('FALSE')
    } else {
      parts.push(`(${typeClauses.join(' OR ')})`)
    }
  }
  if (filters.type !== 'all') {
    params.push(filters.type)
    parts.push(`type = $${params.length}`)
  }
  return { clause: parts.join(' AND '), params }
}

export function buildNotificationListQuery(userId, gaId, filters, limit, settings) {
  const { clause, params } = buildNotificationListWhere(userId, gaId, filters, settings)
  params.push(limit)
  const limitParam = params.length
  const sql = `
    SELECT id, user_id, ga_id, team_id, type, reference_id, message, is_read, is_dismissed,
           customer_id, customer_name, target_date, claim_request_id, special_date_id, created_at, confirmed_at
    FROM (
      SELECT DISTINCT ON (
        user_id,
        ga_id,
        type,
        COALESCE(customer_id, -1),
        COALESCE(special_date_id, -1),
        COALESCE(target_date, DATE '1970-01-01'),
        COALESCE(claim_request_id, -1)
      )
        id, user_id, ga_id, team_id, type, reference_id, message, is_read, is_dismissed,
        customer_id, customer_name, target_date, claim_request_id, special_date_id, created_at, confirmed_at
      FROM notifications
      WHERE ${clause}
      ORDER BY
        user_id,
        ga_id,
        type,
        COALESCE(customer_id, -1),
        COALESCE(special_date_id, -1),
        COALESCE(target_date, DATE '1970-01-01'),
        COALESCE(claim_request_id, -1),
        id ASC
    ) deduped
    ORDER BY created_at DESC, id DESC
    LIMIT $${limitParam}
  `
  return { sql, params }
}

export { parseNotificationListFilters }

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerNotificationsApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/notifications/settings', requireAuth, async (req, res) => {
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
      const data = await getUserNotificationSettings(pool, userId, gaId)
      res.json({ success: true, data })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/notifications/settings', requireAuth, async (req, res) => {
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
      const current = await getUserNotificationSettings(pool, userId, gaId)
      const normalized = normalizeUserNotificationSettingsPatch(req.body, current)
      if (!normalized.ok) {
        res.status(400).json({ message: normalized.message })
        return
      }
      const data = await upsertUserNotificationSettings(pool, userId, gaId, normalized.data)
      await syncDueUserNotifications(pool, safeQuery, userId, gaId).catch((error) => {
        console.error('[notificationsApi] sync after settings patch failed', { userId, gaId, error })
      })
      res.json({ success: true, data })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

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
      await syncDueUserNotifications(pool, safeQuery, userId, gaId).catch((error) => {
        console.error('[notificationsApi] syncDueUserNotifications failed', { userId, gaId, error })
      })
      const settings = await getUserNotificationSettings(pool, userId, gaId)
      const { clause, params } = buildNotificationListWhere(
        userId,
        gaId,
        { view: 'active', type: 'all' },
        settings,
      )
      const r = await safeQuery(
        pool,
        `
        SELECT COUNT(*)::bigint AS c
        FROM notifications
        WHERE ${clause}
          AND is_read = false
        `,
        params,
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
      await syncDueUserNotifications(pool, safeQuery, userId, gaId).catch((error) => {
        console.error('[notificationsApi] syncDueUserNotifications failed', { userId, gaId, error })
      })
      const filters = parseNotificationListFilters(req.query)
      const limRaw = Number(req.query?.limit ?? NOTIFICATIONS_LIST_LIMIT_DEFAULT)
      const limit = Math.min(
        NOTIFICATIONS_LIST_LIMIT_MAX,
        Math.max(1, Number.isFinite(limRaw) ? Math.floor(limRaw) : NOTIFICATIONS_LIST_LIMIT_DEFAULT),
      )
      const settings = await getUserNotificationSettings(pool, userId, gaId)
      let rows = []
      try {
        const { sql, params: listParams } = buildNotificationListQuery(userId, gaId, filters, limit, settings)
        const r = await safeQuery(pool, sql, listParams)
        rows = r.rows
      } catch (listError) {
        console.error('[notificationsApi] notifications list query failed', { userId, gaId, filters, listError })
        rows = []
      }
      const legacySettingsRow = await ensureLegacyNotificationSettings(pool, userId, gaId)
      res.json({
        notifications: rows.map(mapUserNotificationRow),
        settings,
        legacySettings: mapLegacyNotificationSettingsRow(legacySettingsRow),
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
        res.status(404).json({ message: '알림을 찾을 수 없습니다.' })
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

  apiRouter.patch('/notifications/:notificationId/dismiss', requireAuth, async (req, res) => {
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
        res.status(404).json({ message: '알림을 찾을 수 없습니다.' })
        return
      }
      const upd = await safeQuery(
        pool,
        `
        UPDATE notifications
        SET is_dismissed = true, is_read = true, confirmed_at = NOW()
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

  apiRouter.patch('/notifications/read-all', requireAuth, async (req, res) => {
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
      await safeQuery(
        pool,
        `
        UPDATE notifications
        SET is_read = true
        WHERE user_id = $1 AND ga_id = $2 AND is_read = false AND is_dismissed = false
        `,
        [userId, gaId],
      )
      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/notifications/modal-suppress-today', requireAuth, async (req, res) => {
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
      const until = getKstEndOfDayDate()
      await safeQuery(
        pool,
        `
        INSERT INTO notification_settings (user_id, ga_id, modal_suppressed_until)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, ga_id) DO UPDATE
        SET modal_suppressed_until = EXCLUDED.modal_suppressed_until, updated_at = NOW()
        `,
        [userId, gaId, until.toISOString()],
      )
      res.json({ ok: true, modalSuppressedUntil: until.toISOString() })
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
      if (!newsId || newsId.length > 128) {
        res.status(400).json({ message: '삭제할 소식지를 찾을 수 없습니다.' })
        return
      }
      const targetCustomerId = parsePositiveIntLocal(req.query?.targetCustomerId)

      const result = await deleteCustomerNewsletter(pool, {
        actorUserId: userId,
        actorRole: req.user?.role,
        gaId,
        newsId,
        targetCustomerId,
      })

      if (!result.ok) {
        res.status(result.status).json({ message: result.message })
        return
      }
      res.json({ success: true, data: { id: result.deletedId } })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
