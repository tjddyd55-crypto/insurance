import { assertScheduleRange } from '../schedule/scheduleEvents.js'
import { seoulYmd } from '../lib/seoulCalendarDate.js'
import {
  disconnectGoogleForUser,
  loadGoogleCalendarsForUser,
  loadGoogleEventsForUser,
  loadGoogleTasksForUser,
  readGoogleIntegrationStatus,
} from '../integrations/googleCalendarAdapter.js'
import {
  GOOGLE_ACCOUNT_PROVIDER_KEY,
  GOOGLE_CALENDAR_CARD_KEY,
  GOOGLE_WRITE_STATE_KEY,
  GOOGLE_DRIVE_STATE_KEY,
  GOOGLE_WRITE_SETTINGS_STATE_KEY,
  GOOGLE_DRIVE_SETTINGS_STATE_KEY,
  GOOGLE_WRITE_SCOPES,
  GOOGLE_DRIVE_FILE_SCOPE,
  hasDriveFileScope,
  isGoogleDriveEnabled,
  readGooglePickerConfig,
  isGoogleConnectAllowed,
  isGoogleWriteEnabledFor,
  readGoogleOAuthConfig,
} from '../integrations/google/googleOAuthConfig.js'
import { readUserIntegration } from '../integrations/integrationStore.js'
import { withGoogleAccess } from '../integrations/googleCalendarAdapter.js'
import {
  assertGoogleWriteReady,
  createGoogleCalendarEvent,
  createGoogleTask,
  deleteGoogleCalendarEvent,
  deleteGoogleTask,
  listGoogleWriteTargets,
  updateGoogleCalendarEvent,
  updateGoogleTask,
} from '../integrations/google/googleWriteService.js'
import {
  consumeOAuthState,
  createOAuthState,
  OAUTH_BINDING_COOKIE,
  OAUTH_STATE_TTL_MS,
  readCookie,
} from '../integrations/google/googleOAuthStateStore.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  AUTOSYNC_WINDOW_DAYS,
  isAutoSyncEnabledFor,
  isAutoSyncRunning,
  queueAutoSync,
  readAutoSyncSettings,
  saveAutoSyncSettings,
} from '../integrations/google/googleCalendarAutoSync.js'
import { parseGaId } from '../lib/parseGaId.js'
import { buildGoogleAuthorizationUrl, completeGoogleConnection, getGoogleAccessToken, googleError } from '../integrations/google/googleTokenService.js'
import { hasCalendarWriteScope } from '../integrations/google/googleOAuthConfig.js'

const RETURN_PATH = '/service-integrations'
const WRITE_RETURN_PATH = '/schedule'
const DRIVE_RETURN_PATH = '/storage'

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
  drive_disabled: { status: 403, message: 'Google Drive 가져오기는 아직 준비 중입니다.' },
  write_disabled: { status: 403, message: 'Google 쓰기 기능은 아직 준비 중입니다.' },
  write_scope_missing: { status: 409, message: 'Google 일정·할 일 쓰기 권한이 필요합니다. 권한을 추가로 허용해 주세요.' },
  invalid_input: { status: 400, message: '입력값을 확인해 주세요.' },
  calendar_not_writable: { status: 403, message: '이 캘린더에는 일정을 저장할 권한이 없습니다.' },
  tasklist_not_found: { status: 404, message: '할 일 목록을 찾을 수 없습니다.' },
  event_read_only: { status: 409, message: '이 일정은 ONE FC 에서 수정·삭제할 수 없습니다. Google Calendar 에서 변경해 주세요.' },
  google_not_found: { status: 404, message: 'Google 에서 항목을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.' },
  google_not_found_or_unavailable: { status: 502, message: 'Google 응답이 없습니다. 잠시 후 다시 시도해 주세요.' },
  google_conflict: { status: 409, message: '다른 곳에서 먼저 변경되었습니다. 새로고침 후 다시 시도해 주세요.' },
  google_precondition_failed: { status: 409, message: '다른 곳에서 먼저 변경되었습니다. 새로고침 후 다시 시도해 주세요.' },
  google_result_unknown: { status: 504, message: 'Google 저장 결과를 확인하지 못했습니다. 새로고침해서 저장 여부를 확인해 주세요.' },
  google_timeout: { status: 504, message: 'Google 저장 결과를 확인하지 못했습니다. 새로고침해서 저장 여부를 확인해 주세요.' },
  google_bad_request: { status: 400, message: 'Google 이 요청을 거절했습니다. 입력값을 확인해 주세요.' },
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
      ...(code === 'write_scope_missing' ? { needsWriteConsent: true } : {}),
      ...(code === 'event_read_only' && /** @type {any} */ (error)?.reason ? { reason: String(/** @type {any} */ (error).reason) } : {}),
      ...(code === 'invalid_input' && /** @type {any} */ (error)?.field ? { field: String(/** @type {any} */ (error).field) } : {}),
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
  account_mismatch: '연결된 Google 계정과 다른 계정으로 동의했습니다. 기존 연결은 그대로 유지됩니다. 같은 계정으로 다시 시도해 주세요.',
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
/**
 * t311: 서비스 연동 화면의 첫 연결이 묻는 추가 scope. 플래그가 꺼져 있으면 빈 배열(= 기존과 같은 동의 화면).
 * @param {{ feature?: 'calendar' | 'drive' }} options
 */
export function connectExtraScopes(options = {}, env = process.env) {
  if (options.feature === 'drive') return isGoogleDriveEnabled(env) ? [GOOGLE_DRIVE_FILE_SCOPE] : []
  if (options.feature === 'calendar') return isGoogleWriteEnabledFor(options.userId, env) ? [...GOOGLE_WRITE_SCOPES] : []
  return []
}

export async function startGoogleConnect(pool, req, res, options = {}) {
  const purpose = options.purpose === 'write' || options.purpose === 'drive' ? options.purpose : 'connect'
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
  let loginHint = ''
  if (purpose !== 'connect') {
    if (purpose === 'write' ? !isGoogleWriteEnabledFor(userId) : !isGoogleDriveEnabled()) {
      const code = purpose === 'write' ? 'write_disabled' : 'drive_disabled'
      res.status(403).json({ success: false, code, message: GOOGLE_API_ERRORS[code].message })
      return
    }
    const row = await readUserIntegration(pool, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
    if (!row || row.status !== 'connected') {
      res.status(409).json({ success: false, code: 'not_connected', message: GOOGLE_API_ERRORS.not_connected.message })
      return
    }
    loginHint = String(row.accountEmail ?? '')
  }
  const client = requestedOAuthClient(req)
  const fromSettings = options.returnTo === 'settings'
  const created = await createOAuthState(pool, {
    userId,
    providerKey: purpose === 'write'
      ? (fromSettings ? GOOGLE_WRITE_SETTINGS_STATE_KEY : GOOGLE_WRITE_STATE_KEY)
      : purpose === 'drive'
        ? (fromSettings ? GOOGLE_DRIVE_SETTINGS_STATE_KEY : GOOGLE_DRIVE_STATE_KEY)
        : GOOGLE_CALENDAR_CARD_KEY,
    client,
  })
  if (created.binding) {
    res.setHeader('Set-Cookie', bindingCookie(req, created.binding, Math.floor(OAUTH_STATE_TTL_MS / 1000)))
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    success: true,
    data: {
      action: client === 'desktop' ? 'open_external' : 'redirect',
      url: buildGoogleAuthorizationUrl(config, created.state, { purpose, loginHint, extraScopes: purpose === 'connect' ? connectExtraScopes({ ...options, userId }) : [] }),
      ...(client === 'desktop' ? { client, expiresInSeconds: Math.floor(OAUTH_STATE_TTL_MS / 1000) } : {}),
    },
  })
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: import('express').RequestHandler, handleDbError: Function, fetchImpl?: typeof fetch }} deps
 */
export function registerGoogleIntegrationApi(apiRouter, { pool, requireAuth, handleDbError, fetchImpl }) {
  // ---- t321 Google 캘린더 자동 연동(알림 설정) ----
  const autoSyncStatus = async (userId) => {
    const settings = await readAutoSyncSettings(pool, userId)
    const row = await readUserIntegration(pool, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
    const counts = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM google_calendar_sync_map WHERE user_id = $1 GROUP BY status`,
      [userId],
    )
    return {
      available: isAutoSyncEnabledFor(userId),
      connected: Boolean(row && row.status === 'connected'),
      calendarWritable: Boolean(row && row.status === 'connected' && hasCalendarWriteScope(row.credential?.scope)),
      accountEmail: String(row?.accountEmail ?? ''),
      enabled: settings.enabled,
      kinds: settings.kinds,
      lastSyncAt: settings.lastSyncAt,
      lastSyncError: settings.lastSyncError,
      // t327: 'syncing' | 'done' | 'error' | 'idle' — UI 는 저장 후 이 값을 폴링한다(저장은 막지 않음).
      syncStatus: isAutoSyncRunning(userId) || ['queued', 'running'].includes(settings.syncStatus) ? 'syncing' : settings.syncStatus,
      windowDays: AUTOSYNC_WINDOW_DAYS,
      counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
    }
  }
  apiRouter.get('/service-integrations/google/calendar-autosync', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    try {
      res.json({ success: true, data: await autoSyncStatus(currentUserId(req)) })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })
  apiRouter.put('/service-integrations/google/calendar-autosync', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    try {
      const userId = currentUserId(req)
      const gaId = parseGaId(req.gaId ?? req.user?.gaId)
      if (gaId == null) {
        res.status(400).json({ success: false, code: 'ga_required', message: 'GA 컨텍스트가 필요합니다.' })
        return
      }
      const b = req.body && typeof req.body === 'object' ? req.body : {}
      const turningOn = b.enabled === true
      if (turningOn) {
        if (!isAutoSyncEnabledFor(userId)) {
          res.status(403).json({ success: false, code: 'autosync_unavailable', message: 'Google 캘린더 자동 연동은 아직 사용할 수 없습니다.' })
          return
        }
        const row = await readUserIntegration(pool, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
        if (!row || row.status !== 'connected') throw googleError('not_connected')
        if (!hasCalendarWriteScope(row.credential?.scope)) throw googleError('write_scope_missing')
      }
      const kinds = b.kinds && typeof b.kinds === 'object' ? b.kinds : {}
      const saved = await saveAutoSyncSettings(pool, userId, gaId, { enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined, kinds })
      // t327: 초기 동기화·OFF 정리는 백그라운드. 설정 저장 직후 바로 응답한다.
      const sync = await queueAutoSync(pool, userId, { fetchImpl })
      res.json({ success: true, data: { ...(await autoSyncStatus(userId)), marked: saved.marked, sync } })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })
  apiRouter.post('/service-integrations/google/calendar-autosync/sync', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    try {
      const userId = currentUserId(req)
      const sync = await queueAutoSync(pool, userId, { fetchImpl })
      res.json({ success: true, data: { ...(await autoSyncStatus(userId)), sync } })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })

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

  // ---- t307 쓰기 (기능 플래그 + 저장 scope 를 매 요청 서버에서 확인) ----
  const writeRoute = (product, handler) => async (req, res) => {
    try {
      const userId = currentUserId(req)
      await assertGoogleWriteReady(pool, userId, product)
      const data = await withGoogleAccess(pool, { userId, fetchImpl }, (accessToken) => handler({ userId, accessToken, fetchImpl }, req))
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data })
    } catch (error) {
      const code = String(/** @type {any} */ (error)?.code ?? '')
      if (code && !GOOGLE_API_ERRORS[code]) console.warn('[google-write] 실패', { code })
      sendGoogleError(res, error, req, handleDbError)
    }
  }
  const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {})

  apiRouter.post('/service-integrations/google/write/connect', requireAuth, async (req, res) => {
    try {
      await startGoogleConnect(pool, req, res, { purpose: 'write' })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })

  apiRouter.get('/service-integrations/google/write/targets', requireAuth, async (req, res) => {
    try {
      const userId = currentUserId(req)
      if (!isGoogleWriteEnabledFor(userId)) throw Object.assign(new Error('write_disabled'), { code: 'write_disabled' })
      const status = await readGoogleIntegrationStatus(pool, userId)
      const products = { calendar: status.write.calendarWritable, tasks: status.write.tasksWritable }
      const targets = products.calendar || products.tasks
        ? await withGoogleAccess(pool, { userId, fetchImpl }, (accessToken) => listGoogleWriteTargets({ userId, accessToken, fetchImpl }, products))
        : { calendars: [], taskLists: [] }
      res.setHeader('Cache-Control', 'no-store')
      res.json({ success: true, data: { ...status.write, accountEmail: status.accountEmail, ...targets } })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })

  apiRouter.post('/service-integrations/google/write/events', requireAuth, writeRoute('calendar', (access, req) => createGoogleCalendarEvent(access, body(req))))
  apiRouter.patch('/service-integrations/google/write/events', requireAuth, writeRoute('calendar', (access, req) => updateGoogleCalendarEvent(access, body(req).calendarId, body(req).eventId, body(req))))
  apiRouter.delete('/service-integrations/google/write/events', requireAuth, writeRoute('calendar', (access, req) => deleteGoogleCalendarEvent(access, body(req).calendarId ?? req.query.calendarId, body(req).eventId ?? req.query.eventId)))
  apiRouter.post('/service-integrations/google/write/tasks', requireAuth, writeRoute('tasks', (access, req) => createGoogleTask(access, body(req))))
  apiRouter.patch('/service-integrations/google/write/tasks', requireAuth, writeRoute('tasks', (access, req) => updateGoogleTask(access, body(req).taskListId, body(req).taskId, body(req))))
  apiRouter.delete('/service-integrations/google/write/tasks', requireAuth, writeRoute('tasks', (access, req) => deleteGoogleTask(access, body(req).taskListId ?? req.query.taskListId, body(req).taskId ?? req.query.taskId)))

  // ---- t307 PR-B Drive: 증분 동의 + Picker 설정 ----
  apiRouter.post('/service-integrations/google/drive/connect', requireAuth, async (req, res) => {
    try {
      await startGoogleConnect(pool, req, res, { purpose: 'drive' })
    } catch (error) {
      sendGoogleError(res, error, req, handleDbError)
    }
  })

  // Picker 는 브라우저에서 OAuth access token 이 필요하다. 본인 토큰(drive.file 이 있을 때만)만, 캐시 금지로 내려준다.
  apiRouter.get('/service-integrations/google/drive/picker', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    try {
      const userId = currentUserId(req)
      const picker = readGooglePickerConfig()
      const enabled = isGoogleDriveEnabled()
      const row = await readUserIntegration(pool, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
      const connected = Boolean(row && row.status === 'connected')
      const granted = Boolean(connected && hasDriveFileScope(row?.credential?.scope))
      const base = {
        enabled,
        pickerConfigured: picker.configured,
        connected,
        driveGranted: granted,
        accountEmail: String(row?.accountEmail ?? ''),
      }
      if (!enabled || !picker.configured || !granted) {
        res.json({ success: true, data: base })
        return
      }
      const config = readGoogleOAuthConfig()
      const token = await getGoogleAccessToken(pool, config, { userId, fetchImpl })
      res.json({ success: true, data: { ...base, apiKey: picker.apiKey, appId: picker.appId, accessToken: token.accessToken } })
    } catch (error) {
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
    let purpose = 'connect'
    let fromSettings = false
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
      const params = new URLSearchParams({ google: purpose === 'connect' ? result : `${purpose}_${result}` })
      if (reason) params.set('reason', reason)
      const path = fromSettings ? RETURN_PATH : purpose === 'write' ? WRITE_RETURN_PATH : purpose === 'drive' ? DRIVE_RETURN_PATH : RETURN_PATH
      res.redirect(302, `${path}?${params.toString()}`)
    }
    try {
      const consumed = await consumeOAuthState(pool, {
        state: String(req.query.state ?? ''),
        binding: readCookie(req.headers.cookie, OAUTH_BINDING_COOKIE),
        providerKey: GOOGLE_CALENDAR_CARD_KEY,
        providerKeys: [GOOGLE_CALENDAR_CARD_KEY, GOOGLE_WRITE_STATE_KEY, GOOGLE_DRIVE_STATE_KEY, GOOGLE_WRITE_SETTINGS_STATE_KEY, GOOGLE_DRIVE_SETTINGS_STATE_KEY],
      })
      client = consumed.client ?? ''
      if (consumed.ok && (consumed.providerKey === GOOGLE_WRITE_STATE_KEY || consumed.providerKey === GOOGLE_WRITE_SETTINGS_STATE_KEY)) purpose = 'write'
      if (consumed.ok && (consumed.providerKey === GOOGLE_DRIVE_STATE_KEY || consumed.providerKey === GOOGLE_DRIVE_SETTINGS_STATE_KEY)) purpose = 'drive'
      if (consumed.ok && (consumed.providerKey === GOOGLE_WRITE_SETTINGS_STATE_KEY || consumed.providerKey === GOOGLE_DRIVE_SETTINGS_STATE_KEY)) fromSettings = true
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
        // 쓰기 동의 거절: 기존 읽기 연결은 그대로다(토큰을 건드리지 않는다).
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
      const completed = await completeGoogleConnection(pool, config, { userId: consumed.userId, code, purpose, fetchImpl })
      if (purpose === 'drive') {
        back(completed.driveFileGranted ? 'connected' : 'error', completed.driveFileGranted ? '' : 'drive_scope_missing')
        return
      }
      if (purpose === 'write') {
        back('connected', completed.calendarWritable && completed.tasksWritable ? '' : 'write_scope_partial')
        return
      }
      back('connected', completed.tasksReadable ? '' : 'tasks_scope_missing')
    } catch (error) {
      const code = String(/** @type {any} */ (error)?.code ?? '')
      const known = ['account_mismatch', 'scope_missing', 'refresh_token_missing', 'google_token_failed', 'google_unavailable', 'google_userinfo_failed', 'needs_reauth']
      if (!known.includes(code)) {
        console.error('[google-oauth] callback 실패', { code: code || 'server_error' })
      }
      back('error', known.includes(code) ? code : 'server_error')
    }
  })
}

export { disconnectGoogleForUser }
