import { parseGaId } from '../lib/parseGaId.js'
import { loadScheduleEvents } from '../schedule/scheduleQuery.js'
import { assertScheduleRange, parseScheduleSources } from '../schedule/scheduleEvents.js'

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function readScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    res.status(401).json({ success: false, code: 'unauthorized', message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ success: false, code: 'ga_required', message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return { userId, gaId }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function }} deps
 */
export function registerScheduleApi(apiRouter, { pool, requireAuth, handleDbError }) {
  apiRouter.get('/schedule/events', requireAuth, async (req, res) => {
    const scope = readScope(req, res)
    if (!scope) {
      return
    }
    try {
      const fromYmd = String(req.query.from ?? '').trim()
      const toYmd = String(req.query.to ?? '').trim()
      assertScheduleRange(fromYmd, toYmd)
      const sources = parseScheduleSources(req.query.sources)
      const calendarIds = [...new Set(String(req.query.calendarIds ?? '').split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 30)
      const taskListIds = [...new Set(String(req.query.taskListIds ?? '').split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 30)
      const data = await loadScheduleEvents(pool, { ...scope, fromYmd, toYmd, sources, calendarIds, taskListIds, viewer: req.user })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data })
    } catch (error) {
      if (error?.code === 'invalid_range' || error?.code === 'range_too_wide' || error?.code === 'invalid_source') {
        res.status(400).json({
          success: false,
          code: error.code,
          message: scheduleErrorMessage(error.code),
        })
        return
      }
      handleDbError(error, req, res)
    }
  })
}

/**
 * @param {string} code
 */
function scheduleErrorMessage(code) {
  if (code === 'invalid_source') {
    return '알 수 없는 일정 출처입니다.'
  }
  if (code === 'range_too_wide') {
    return '조회 기간이 너무 깁니다.'
  }
  return '조회 기간은 YYYY-MM-DD 이고 시작이 끝보다 늦지 않아야 합니다.'
}
