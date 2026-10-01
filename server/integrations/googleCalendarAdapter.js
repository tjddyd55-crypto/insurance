import { addDaysYmd } from '../lib/seoulCalendarDate.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { decryptSmsCredential } from '../sms/smsCredentialsCrypto.js'
import { normalizeGoogleCalendarEvent } from '../schedule/scheduleEvents.js'

const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export function isGoogleCalendarConfigured() {
  return String(process.env.GOOGLE_OAUTH_CLIENT_ID ?? '').trim().length > 0
}

/**
 * 토큰 원문은 반환 객체의 accessToken 에만 둔다. 호출부는 로그에 넣지 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 */
export async function readGoogleCalendarCredential(pool, userId) {
  const result = await systemQuery(
    pool,
    `
    SELECT status, credential_ciphertext
    FROM service_integrations
    WHERE owner_scope = 'USER'
      AND user_id = $1
      AND ga_id IS NULL
      AND provider_key = 'google_calendar'
    `,
    [userId],
  )
  const row = result.rows[0]
  if (!row || row.status !== 'connected' || !row.credential_ciphertext) {
    return { connected: false, accessToken: '' }
  }
  const plain = decryptSmsCredential(row.credential_ciphertext)
  const accessToken = accessTokenFromStoredSecret(plain)
  return { connected: Boolean(accessToken), accessToken }
}

/**
 * @param {string} plain
 */
export function accessTokenFromStoredSecret(plain) {
  const text = String(plain ?? '').trim()
  if (!text) {
    return ''
  }
  if (text.startsWith('{')) {
    const parsed = JSON.parse(text)
    return String(parsed.accessToken ?? parsed.access_token ?? '').trim()
  }
  return text
}

/**
 * @param {{ accessToken: string, fromYmd: string, toYmd: string, fetchImpl?: typeof fetch }} input
 */
export async function fetchGoogleCalendarEvents(input) {
  const fetchImpl = input.fetchImpl ?? fetch
  const url = new URL(GOOGLE_EVENTS_URL)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('timeMin', `${input.fromYmd}T00:00:00+09:00`)
  url.searchParams.set('timeMax', `${addDaysYmd(input.toYmd, 1)}T00:00:00+09:00`)
  url.searchParams.set('maxResults', '250')
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  })
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'google_unauthorized' : 'google_calendar_unavailable')
    error.code = error.message
    throw error
  }
  const body = await response.json()
  const items = Array.isArray(body.items) ? body.items : []
  return items
    .map((item) => normalizeGoogleCalendarEvent(item))
    .filter(Boolean)
}

/**
 * Google 실패는 일정 전체 실패로 올리지 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fromYmd: string, toYmd: string, fetchImpl?: typeof fetch }} scope
 */
export async function loadGoogleCalendarSchedule(pool, scope) {
  if (!isGoogleCalendarConfigured()) {
    return { configured: false, connected: false, status: 'unconfigured', events: [] }
  }
  let credential
  try {
    credential = await readGoogleCalendarCredential(pool, scope.userId)
  } catch {
    return { configured: true, connected: false, status: 'error', events: [] }
  }
  if (!credential.connected) {
    return { configured: true, connected: false, status: 'disconnected', events: [] }
  }
  try {
    const events = await fetchGoogleCalendarEvents({
      accessToken: credential.accessToken,
      fromYmd: scope.fromYmd,
      toYmd: scope.toYmd,
      fetchImpl: scope.fetchImpl,
    })
    return { configured: true, connected: true, status: 'connected', events }
  } catch (error) {
    const code = error && error.code === 'google_unauthorized' ? 'error' : 'error'
    return { configured: true, connected: true, status: code, events: [] }
  }
}
