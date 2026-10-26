/**
 * 일정 화면 표시 설정(사용자별). 표시 여부만 저장 — 일정/할 일/Google 원본 데이터는 건드리지 않는다.
 * - GET   /me/schedule-view-prefs  → { prefs, updatedAt } (행 없음 = prefs {} → 클라이언트 기본값)
 * - PATCH /me/schedule-view-prefs  body { prefs: {...부분} } → 허용 키만 병합 저장
 * user_id 는 세션(req.user.id)에서만 — 바디/쿼리의 사용자 id 는 무시.
 */

export const SCHEDULE_VIEW_PREF_SOURCES = ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age']
export const SCHEDULE_VIEW_PREF_KEYS = ['sources', 'includeCompleted', 'includeOverdue', 'googleCalendarIds', 'holidayMode']
const MAX_CALENDAR_IDS = 50
const MAX_CALENDAR_ID_LENGTH = 256

/**
 * @param {unknown} raw
 * @returns {{ ok: true, patch: Record<string, unknown> } | { ok: false, message: string }}
 */
export function validateScheduleViewPrefsPatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'prefs 객체가 필요합니다.' }
  const patch = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!SCHEDULE_VIEW_PREF_KEYS.includes(key)) return { ok: false, message: `허용되지 않은 설정 키: ${key}` }
    if (key === 'sources') {
      if (!Array.isArray(value) || value.some((item) => !SCHEDULE_VIEW_PREF_SOURCES.includes(item))) return { ok: false, message: 'sources 값이 올바르지 않습니다.' }
      // 순서 고정 + 중복 제거. 빈 배열(모두 OFF)도 그대로 저장.
      patch.sources = SCHEDULE_VIEW_PREF_SOURCES.filter((item) => value.includes(item))
    } else if (key === 'includeCompleted' || key === 'includeOverdue') {
      if (typeof value !== 'boolean') return { ok: false, message: `${key} 는 true/false 여야 합니다.` }
      patch[key] = value
    } else if (key === 'googleCalendarIds') {
      if (value === null) { patch.googleCalendarIds = null; continue }
      if (!Array.isArray(value) || value.length > MAX_CALENDAR_IDS || value.some((id) => typeof id !== 'string' || !id.trim() || id.length > MAX_CALENDAR_ID_LENGTH)) {
        return { ok: false, message: 'googleCalendarIds 값이 올바르지 않습니다.' }
      }
      patch.googleCalendarIds = [...new Set(value.map((id) => id.trim()))]
    } else if (key === 'holidayMode') {
      if (value !== 'kr' && value !== 'none') return { ok: false, message: 'holidayMode 값이 올바르지 않습니다.' }
      patch.holidayMode = value
    }
  }
  return { ok: true, patch }
}

/** 저장된 JSON 에서 허용 키·유효 값만 돌려준다(과거/손상 값 방어). */
export function sanitizeStoredScheduleViewPrefs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const key of SCHEDULE_VIEW_PREF_KEYS) {
    if (!(key in raw)) continue
    const checked = validateScheduleViewPrefsPatch({ [key]: raw[key] })
    if (checked.ok) Object.assign(out, checked.patch)
  }
  return out
}

export async function ensureScheduleViewPrefsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_schedule_view_prefs (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} ctx
 */
export function registerScheduleViewPrefsApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  function sessionUserId(req, res) {
    const userId = String(req.user?.id ?? '').trim()
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return ''
    }
    return userId
  }

  apiRouter.get('/me/schedule-view-prefs', requireAuth, async (req, res) => {
    try {
      const userId = sessionUserId(req, res)
      if (!userId) return
      const r = await pool.query('SELECT prefs, updated_at FROM user_schedule_view_prefs WHERE user_id = $1', [userId])
      const row = r.rows[0]
      res.json({ prefs: sanitizeStoredScheduleViewPrefs(row?.prefs), updatedAt: row?.updated_at ?? null })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/me/schedule-view-prefs', requireAuth, async (req, res) => {
    try {
      const userId = sessionUserId(req, res)
      if (!userId) return
      const checked = validateScheduleViewPrefsPatch(req.body?.prefs)
      if (!checked.ok) {
        res.status(400).json({ message: checked.message, code: 'invalid_schedule_view_prefs' })
        return
      }
      const r = await pool.query(
        `INSERT INTO user_schedule_view_prefs (user_id, prefs, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET prefs = user_schedule_view_prefs.prefs || EXCLUDED.prefs, updated_at = NOW()
         RETURNING prefs, updated_at`,
        [userId, JSON.stringify(checked.patch)],
      )
      const row = r.rows[0]
      res.json({ prefs: sanitizeStoredScheduleViewPrefs(row?.prefs), updatedAt: row?.updated_at ?? null })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
