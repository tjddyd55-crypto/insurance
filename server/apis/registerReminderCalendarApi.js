import { parseGaId } from '../lib/parseGaId.js'
import { seoulYmd } from '../lib/seoulCalendarDate.js'
import { loadReminderList, loadReminderMonth } from '../reminders/reminderQuery.js'

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function readScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return { userId, gaId }
}

/**
 * @param {string} raw
 */
function parseMonth(raw) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(raw ?? '').trim())
  if (!match) {
    const today = seoulYmd()
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  }
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) {
    return null
  }
  return { year, month }
}

/**
 * @param {unknown} raw
 */
function ymdOrEmpty(raw) {
  const text = String(raw ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function }} deps
 */
export function registerReminderCalendarApi(apiRouter, { pool, requireAuth, handleDbError }) {
  apiRouter.get('/reminders/calendar', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) {
      return
    }
    const month = parseMonth(req.query.month)
    if (!month) {
      res.status(400).json({ message: '월은 YYYY-MM 형식이어야 합니다.' })
      return
    }
    try {
      const data = await loadReminderMonth(pool, { ...scope, ...month })
      res.json({ success: true, data })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/reminders', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) {
      return
    }
    try {
      const data = await loadReminderList(pool, {
        ...scope,
        type: String(req.query.type ?? 'all'),
        query: String(req.query.q ?? ''),
        fromYmd: ymdOrEmpty(req.query.from),
        toYmd: ymdOrEmpty(req.query.to),
        sort: String(req.query.sort ?? 'soon'),
      })
      res.json({ success: true, data })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
