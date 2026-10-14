import { parseGaId } from '../lib/parseGaId.js'
import { loadScheduleEvents } from '../schedule/scheduleQuery.js'
import { assertScheduleRange, parseScheduleSources } from '../schedule/scheduleEvents.js'
import { clearGoogleUserCache } from '../integrations/google/googleUserCache.js'

/** 수동 새로고침(refresh=1) 최소 간격. Google quota 보호, 사용자별. */
export const SCHEDULE_REFRESH_MIN_INTERVAL_MS = 10 * 1000
/** @type {Map<string, number>} userId → 마지막 수동 새로고침 시각 */
const lastManualRefreshAt = new Map()

export function resetScheduleRefreshLimitForTest() {
  lastManualRefreshAt.clear()
}

/**
 * 허용이면 시각을 기록하고 0, 아니면 남은 초.
 * @param {string} userId
 * @param {number} now
 */
export function takeScheduleRefreshSlot(userId, now = Date.now()) {
  const last = lastManualRefreshAt.get(userId)
  const waitMs = last === undefined ? 0 : last + SCHEDULE_REFRESH_MIN_INTERVAL_MS - now
  if (waitMs > 0) return Math.ceil(waitMs / 1000)
  if (lastManualRefreshAt.size > 5000) {
    for (const [key, at] of lastManualRefreshAt) if (at + SCHEDULE_REFRESH_MIN_INTERVAL_MS < now) lastManualRefreshAt.delete(key)
  }
  lastManualRefreshAt.set(userId, now)
  return 0
}

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
      const manualRefresh = String(req.query.refresh ?? '') === '1'
      if (manualRefresh) {
        const retryAfterSec = takeScheduleRefreshSlot(scope.userId)
        if (retryAfterSec > 0) {
          res.setHeader('Retry-After', String(retryAfterSec))
          res.setHeader('Cache-Control', 'no-store')
          res.status(429).json({
            success: false,
            code: 'refresh_rate_limited',
            message: `일정 새로고침은 잠시 후 다시 시도해 주세요. (${retryAfterSec}초)`,
            retryAfterSec,
          })
          return
        }
        // 그 사용자 Google 캐시만 비운다(키는 항상 사용자 id 로 시작). 다른 사용자 캐시는 그대로.
        clearGoogleUserCache(scope.userId)
        console.info('[schedule] manual refresh', { cacheBypassed: true })
      }
      const data = await loadScheduleEvents(pool, { ...scope, fromYmd, toYmd, sources, calendarIds, viewer: req.user })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data: { ...data, fetchedAt: new Date().toISOString(), cacheBypassed: manualRefresh } })
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
