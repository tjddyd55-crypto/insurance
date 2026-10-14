import { assertScheduleRange } from '../schedule/scheduleEvents.js'
import { seoulYmd } from '../lib/seoulCalendarDate.js'
import {
  disconnectGoogleForUser,
  loadGoogleCalendarsForUser,
  loadGoogleEventsForUser,
  loadGoogleTasksForUser,
  readGoogleIntegrationStatus,
} from '../integrations/googleCalendarAdapter.js'
import { GOOGLE_CALENDAR_CARD_KEY, isGoogleConnectAllowed, readGoogleOAuthConfig } from '../integrations/google/googleOAuthConfig.js'
import {
  consumeOAuthState,
  createOAuthState,
  OAUTH_BINDING_COOKIE,
  OAUTH_STATE_TTL_MS,
  readCookie,
} from '../integrations/google/googleOAuthStateStore.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { buildGoogleAuthorizationUrl, completeGoogleConnection } from '../integrations/google/googleTokenService.js'

const RETURN_PATH = '/service-integrations'

const GOOGLE_API_ERRORS = {
  unconfigured: { status: 409, message: 'Google 연동 설정이 아직 없습니다. 관리자에게 문의해 주세요.' },
  not_connected: { status: 409, message: 'Google 계정이 연결되어 있지 않습니다.' },
  needs_reauth: { status: 409, message: 'Google 연결이 만료되었습니다. 서비스 연동에서 다시 연결해 주세요.' },
  scope_missing: { status: 409, message: 'Google Tasks 읽기 권한이 없습니다. 서비스 연동에서 Google 을 다시 연결해 주세요.' },
  google_forbidden: { status: 502, message: 'Google Calendar 접근 권한이 없습니다. 다시 연결해 주세요.' },
  google_unauthorized: { status: 409, message: 'Google 연결이 만료되었습니다. 서비스 연동에서 다시 연결해 주세요.' },
  google_unavailable: { status: 502, message: 'Google 응답이 없습니다. 잠시 후 다시 시도해 주세요.' },
  google_api_disabled: { status: 503, message: 'Google 연동 서버 설정을 확인 중입니다. 관리자에게 문의해 주세요.' },
  google_rate_limited: { status: 503, message: 'Google 요청이 많아 잠시 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
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
 * 데스크톱 앱(Electron)은 body.client === 'desktop' 를 명시적으로 보낸다. UA 로는 판단하지 않는다.
 * @param {import('express').Request} req
 */
export function requestedOAuthClient(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  return body.client === 'desktop' ? 'desktop' : 'web'
}

/** @param {string} username */
export function maskAccountId(username) {
  const text = String(username ?? '').trim()
  if (!text) return ''
  if (text.length <= 2) return `${text[0]}*`
  const keep = text.length <= 4 ? 1 : 2
  return `${text.slice(0, keep)}${'*'.repeat(Math.min(6, text.length - keep))}`
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}

const DESKTOP_ERROR_TEXT = {
  access_denied: 'Google 동의가 취소되어 연결되지 않았습니다.',
  state_expired: '연동 요청 시간이 지났습니다. ONE FC 앱에서 다시 연동해 주세요.',
  state_invalid: '연동 요청이 올바르지 않거나 이미 사용되었습니다. ONE FC 앱에서 다시 연동해 주세요.',
  user_inactive: '연동할 ONE FC 계정을 찾을 수 없습니다.',
}

/**
 * 시스템 브라우저에 보여 줄 단순 결과 페이지(앱 세션으로 이동하지 않는다).
 * @param {{ ok: boolean, accountMasked?: string, reason?: string, tasksScopeMissing?: boolean }} input
 */
export function renderDesktopResultPage(input) {
  const title = input.ok ? '연동 완료. ONE FC 앱으로 돌아가세요' : 'Google 연동 실패'
  const lines = []
  if (input.ok) {
    if (input.accountMasked) lines.push(`ONE FC 계정 <b>${escapeHtml(input.accountMasked)}</b> 에 Google 계정이 연결되었습니다.`)
    if (input.tasksScopeMissing) lines.push('Tasks 읽기 권한이 없어 할 일 일부가 표시되지 않을 수 있습니다.')
    lines.push('본인 ONE FC 계정이 아니라면 앱의 서비스 연동에서 즉시 연동 해제해 주세요.')
    lines.push('이 창은 닫아도 됩니다.')
  } else {
    lines.push(escapeHtml(DESKTOP_ERROR_TEXT[input.reason ?? ''] ?? 'Google 계정 연결에 실패했습니다. ONE FC 앱에서 다시 시도해 주세요.'))
  }
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;background:#f5f6f8;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}main{background:#fff;border-radius:12px;padding:32px 36px;max-width:440px;box-shadow:0 2px 12px rgba(0,0,0,.08)}h1{font-size:20px;margin:0 0 16px}p{margin:8px 0;color:#333;line-height:1.5}</style></head>
<body><main><h1>${escapeHtml(title)}</h1>${lines.map((line) => `<p>${line}</p>`).join('')}</main></body></html>`
}

/**
 * 바인딩된 사용자가 아직 활성인지 확인하고 마스킹된 계정 id 를 돌려준다. 없으면 null.
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
async function readActiveAccount(pool, userId) {
  const result = await systemQuery(pool, `SELECT username FROM users WHERE id = $1 AND is_deleted = false LIMIT 1`, [userId])
  const row = result.rows[0]
  return row ? { accountMasked: maskAccountId(row.username) } : null
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
  if (!isGoogleConnectAllowed(req.user)) {
    res.status(403).json({ success: false, code: 'google_connect_not_ready', message: 'Google 연동 준비 중입니다.' })
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
  const client = requestedOAuthClient(req)
  const created = await createOAuthState(pool, { userId, providerKey: GOOGLE_CALENDAR_CARD_KEY, client })
  if (created.binding) {
    res.setHeader('Set-Cookie', bindingCookie(req, created.binding, Math.floor(OAUTH_STATE_TTL_MS / 1000)))
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    success: true,
    data: {
      action: client === 'desktop' ? 'open_external' : 'redirect',
      url: buildGoogleAuthorizationUrl(config, created.state),
      ...(client === 'desktop' ? { client, expiresInSeconds: Math.floor(OAUTH_STATE_TTL_MS / 1000) } : {}),
    },
  })
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
      res.json({ success: true, data: { ...data, connectAllowed: isGoogleConnectAllowed(req.user) } })
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
  // 데스크톱 state(로그인된 데스크톱 앱이 만든 것)만 쿠키 확인을 건너뛰고, 결과는 단순 페이지로 보여 준다.
  apiRouter.get('/service-integrations/google/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Set-Cookie', bindingCookie(req, '', 0))
    /** @type {'web' | 'desktop' | ''} */
    let client = ''
    let accountMasked = ''
    const back = (result, reason) => {
      // 데스크톱 state 는 앱 세션으로 보내지 않고 결과 페이지를 보여 준다. 웹·알 수 없는 state 는 기존대로 redirect.
      if (client === 'desktop') {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        res.setHeader('Referrer-Policy', 'no-referrer')
        res.status(result === 'connected' ? 200 : 400).type('html').send(
          renderDesktopResultPage({ ok: result === 'connected', accountMasked, reason, tasksScopeMissing: reason === 'tasks_scope_missing' }),
        )
        return
      }
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
      client = consumed.client ?? ''
      if (!consumed.ok) {
        back('error', consumed.reason)
        return
      }
      if (consumed.client === 'desktop') {
        const account = await readActiveAccount(pool, consumed.userId)
        if (!account) {
          back('error', 'user_inactive')
          return
        }
        accountMasked = account.accountMasked
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
