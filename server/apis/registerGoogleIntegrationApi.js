import { assertScheduleRange } from '../schedule/scheduleEvents.js'
import { seoulYmd } from '../lib/seoulCalendarDate.js'
import {
  disconnectGoogleForUser,
  loadGoogleCalendarsForUser,
  loadGoogleEventsForUser,
  loadGoogleTasksForUser,
  readGoogleIntegrationStatus,
} from '../integrations/googleCalendarAdapter.js'
import { GOOGLE_CALENDAR_CARD_KEY, readGoogleOAuthConfig } from '../integrations/google/googleOAuthConfig.js'
import {
  consumeOAuthState,
  createOAuthState,
  OAUTH_BINDING_COOKIE,
  OAUTH_STATE_TTL_MS,
  readCookie,
} from '../integrations/google/googleOAuthStateStore.js'
import { buildGoogleAuthorizationUrl, completeGoogleConnection } from '../integrations/google/googleTokenService.js'

const RETURN_PATH = '/service-integrations'

const GOOGLE_API_ERRORS = {
  unconfigured: { status: 409, message: 'Google 연동 설정이 아직 없습니다. 관리자에게 문의해 주세요.' },
  not_connected: { status: 409, message: 'Google 계정이 연결되어 있지 않습니다.' },
  needs_reauth: { status: 409, message: 'Google 연결이 만료되었습니다. 서비스 연동에서 다시 연결해 주세요.' },
  scope_missing: { status: 409, message: 'Google Tasks 읽기 권한이 없습니다. 서비스 연동에서 Google 을 다시 연결해 주세요.' },
  google_forbidden: { status: 502, message: 'Google Calendar 접근 권한이 없습니다. 다시 연결해 주세요.' },
  google_unauthorized: { status: 409, message: 'Google 연결이 만료되었습니다. 서비스 연동에서 다시 연결해 주세요.' },
  google_unavailable: { status: 502, message: 'Google Calendar 응답이 없습니다. 잠시 후 다시 시도해 주세요.' },
  google_token_failed: { status: 502, message: 'Google 인증 서버 응답을 처리하지 못했습니다.' },
}

/**
 * 현재 로그인 사용자 id. 다른 값(쿼리·바디의 id)은 쓰지 않는다.
 * @param {import('express').Request} req
 */
function currentUserId(req) {
  return String(req.user?.id ?? '').trim()
}

/**
 * @param {import('express').Request} req
 */
function isHttps(req) {
  return Boolean(req.secure) || String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https'
}

/**
 * @param {import('express').Request} req
 * @param {string} value
 * @param {number} maxAgeSeconds
 */
function bindingCookie(req, value, maxAgeSeconds) {
  const parts = [
    `${OAUTH_BINDING_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isHttps(req)) parts.push('Secure')
  return parts.join('; ')
}

/**
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {import('express').Request} req
 * @param {Function} handleDbError
 */
function sendGoogleError(res, error, req, handleDbError) {
  const code = String(/** @type {any} */ (error)?.code ?? '')
  const known = GOOGLE_API_ERRORS[code]
  if (known) {
    res.status(known.status).json({
      success: false,
      code: code === 'google_unauthorized' ? 'needs_reauth' : code,
      message: known.message,
      ...(code === 'scope_missing' ? { needsReconsent: true } : {}),
    })
    return
  }
  if (code === 'invalid_range' || code === 'range_too_wide') {
    res.status(400).json({ success: false, code, message: '조회 기간을 확인해 주세요.' })
    return
  }
  const status = Number(/** @type {any} */ (error)?.status)
  if (status === 401) {
    res.status(401).json({ success: false, code: 'unauthorized', message: '로그인이 필요합니다.' })
    return
  }
  handleDbError(error, req, res)
}

/**
 * @param {unknown} raw
 */
function parseCalendarIds(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return []
  return [...new Set(text.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 30)
}

/**
 * OAuth 시작. 현재 로그인 사용자에게 state 를 묶고, 같은 브라우저 확인용 HttpOnly 쿠키를 건다.
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function startGoogleConnect(pool, req, res) {
  const userId = currentUserId(req)
  if (!userId) {
    res.status(401).json({ success: false, code: 'unauthorized', message: '로그인이 필요합니다.' })
    return
  }
  const config = readGoogleOAuthConfig()
  if (!config.configured) {
    res.status(409).json({
      success: false,
      code: 'provider_unconfigured',
      message: '클라이언트 설정이 없어 연동할 수 없습니다.',
    })
    return
  }
  const created = await createOAuthState(pool, { userId, providerKey: GOOGLE_CALENDAR_CARD_KEY })
  res.setHeader('Set-Cookie', bindingCookie(req, created.binding, Math.floor(OAUTH_STATE_TTL_MS / 1000)))
  res.setHeader('Cache-Control', 'no-store')
  res.json({ success: true, data: { action: 'redirect', url: buildGoogleAuthorizationUrl(config, created.state) } })
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function, fetchImpl?: typeof fetch }} deps
 */
export function registerGoogleIntegrationApi(apiRouter, { pool, requireAuth, handleDbError, fetchImpl }) {
  apiRouter.get('/service-integrations/google/status', requireAuth, async (req, res) => {
    try {
      const data = await readGoogleIntegrationStatus(pool, currentUserId(req))
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })

  apiRouter.get('/service-integrations/google/calendars', requireAuth, async (req, res) => {
    try {
      const calendars = await loadGoogleCalendarsForUser(pool, { userId: currentUserId(req), fetchImpl })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data: { calendars } })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })

  apiRouter.get('/service-integrations/google/events', requireAuth, async (req, res) => {
    try {
      const fromYmd = String(req.query.start ?? '').trim()
      const toYmd = String(req.query.end ?? '').trim()
      assertScheduleRange(fromYmd, toYmd)
      const result = await loadGoogleEventsForUser(pool, {
        userId: currentUserId(req),
        fromYmd,
        toYmd,
        calendarIds: parseCalendarIds(req.query.calendarIds),
        fetchImpl,
      })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data: { start: fromYmd, end: toYmd, calendars: result.calendars, events: result.events } })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })

  apiRouter.get('/service-integrations/google/tasks', requireAuth, async (req, res) => {
    try {
      const fromYmd = String(req.query.start ?? '').trim()
      const toYmd = String(req.query.end ?? '').trim()
      assertScheduleRange(fromYmd, toYmd)
      const result = await loadGoogleTasksForUser(pool, {
        userId: currentUserId(req),
        fromYmd,
        toYmd,
        todayYmd: seoulYmd(),
        fetchImpl,
      })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data: { start: fromYmd, end: toYmd, taskLists: result.taskLists, tasks: result.tasks } })
    } catch (error) {
      if (String(/** @type {any} */ (error)?.code ?? '') === 'google_forbidden') {
        res.status(502).json({ success: false, code: 'google_forbidden', message: 'Google Tasks 를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.' })
        return
      }
      sendGoogleError(res, error, req, handleDbError)
    }
  })

  // Google 이 브라우저를 돌려보내는 주소. Bearer 가 없으므로 state(DB, 1회용) + 바인딩 쿠키로 사용자를 확인한다.
  apiRouter.get('/service-integrations/google/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Set-Cookie', bindingCookie(req, '', 0))
    const back = (result, reason) => {
      const params = new URLSearchParams({ google: result })
      if (reason) params.set('reason', reason)
      res.redirect(302, `${RETURN_PATH}?${params.toString()}`)
    }
    try {
      const consumed = await consumeOAuthState(pool, {
        state: String(req.query.state ?? ''),
        binding: readCookie(req.headers.cookie, OAUTH_BINDING_COOKIE),
        providerKey: GOOGLE_CALENDAR_CARD_KEY,
      })
      if (!consumed.ok) {
        back('error', consumed.reason)
        return
      }
      if (req.query.error) {
        back('error', String(req.query.error) === 'access_denied' ? 'access_denied' : 'google_error')
        return
      }
      const code = String(req.query.code ?? '').trim()
      if (!code) {
        back('error', 'code_missing')
        return
      }
      const config = readGoogleOAuthConfig()
      if (!config.configured) {
        back('error', 'unconfigured')
        return
      }
      const completed = await completeGoogleConnection(pool, config, { userId: consumed.userId, code, fetchImpl })
      back('connected', completed.tasksReadable ? '' : 'tasks_scope_missing')
    } catch (error) {
      const code = String(/** @type {any} */ (error)?.code ?? '')
      const known = ['scope_missing', 'refresh_token_missing', 'google_token_failed', 'google_unavailable', 'google_userinfo_failed', 'needs_reauth']
      if (!known.includes(code)) {
        console.error('[google-oauth] callback 실패', { code: code || 'server_error' })
      }
      back('error', known.includes(code) ? code : 'server_error')
    }
  })
}

export { disconnectGoogleForUser }
