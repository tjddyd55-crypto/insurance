import { addDaysYmd, zonedDayStartIso } from '../../lib/seoulCalendarDate.js'
import { normalizeGoogleCalendarEvent } from '../../schedule/scheduleEvents.js'
import { googleError } from './googleTokenService.js'
import { googleCacheKey, readGoogleCache, writeGoogleCache } from './googleUserCache.js'

const API_BASE = 'https://www.googleapis.com/calendar/v3'
const MAX_PAGES = 10
const PAGE_SIZE = 250

/**
 * @param {typeof fetch} fetchImpl
 * @param {URL} url
 * @param {string} accessToken
 */
async function getJson(fetchImpl, url, accessToken) {
  let response
  try {
    response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch {
    throw googleError('google_unavailable')
  }
  if (response.status === 401) {
    throw googleError('google_unauthorized')
  }
  if (response.status === 403) {
    throw googleError('google_forbidden')
  }
  if (!response.ok) {
    throw googleError('google_unavailable')
  }
  return response.json()
}

/**
 * calendarList item → 화면용. 원본은 넘기지 않는다.
 * @param {Record<string, any>} item
 */
export function normalizeGoogleCalendar(item) {
  if (!item || !item.id || item.deleted) {
    return null
  }
  const primary = item.primary === true
  const selected = item.selected === true
  return {
    id: String(item.id),
    name: String(item.summaryOverride ?? item.summary ?? '').trim() || String(item.id),
    primary,
    accessRole: String(item.accessRole ?? ''),
    timezone: String(item.timeZone ?? ''),
    selected,
    defaultVisible: primary || selected,
  }
}

/**
 * @param {{ userId: string, accessToken: string, fetchImpl?: typeof fetch, useCache?: boolean }} input
 */
export async function listGoogleCalendars(input) {
  const key = googleCacheKey('google-calendars', input.userId)
  if (input.useCache !== false) {
    const cached = readGoogleCache(key)
    if (cached) return cached
  }
  const fetchImpl = input.fetchImpl ?? fetch
  const calendars = []
  let pageToken = ''
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${API_BASE}/users/me/calendarList`)
    url.searchParams.set('maxResults', String(PAGE_SIZE))
    url.searchParams.set('minAccessRole', 'reader')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const body = await getJson(fetchImpl, url, input.accessToken)
    for (const item of Array.isArray(body.items) ? body.items : []) {
      const calendar = normalizeGoogleCalendar(item)
      if (calendar && item.hidden !== true) calendars.push(calendar)
    }
    pageToken = String(body.nextPageToken ?? '')
    if (!pageToken) break
  }
  calendars.sort((left, right) => Number(right.primary) - Number(left.primary) || left.name.localeCompare(right.name, 'ko'))
  writeGoogleCache(key, calendars)
  return calendars
}

/**
 * 화면 기간(서울 달력일 from~to, 포함)을 Google timeMin/timeMax(exclusive) 로.
 * @param {string} fromYmd
 * @param {string} toYmd
 */
export function googleTimeWindow(fromYmd, toYmd) {
  return {
    timeMin: zonedDayStartIso(fromYmd),
    timeMax: zonedDayStartIso(addDaysYmd(toYmd, 1)),
  }
}

/**
 * 한 캘린더의 기간 일정. nextPageToken 을 끝까지(최대 MAX_PAGES) 따라간다.
 * @param {{ userId: string, accessToken: string, calendar: { id: string, name?: string, timezone?: string }, fromYmd: string, toYmd: string, fetchImpl?: typeof fetch }} input
 */
export async function listGoogleCalendarEvents(input) {
  const window = googleTimeWindow(input.fromYmd, input.toYmd)
  const key = googleCacheKey('google-events', input.userId, [input.calendar.id, window.timeMin, window.timeMax])
  const cached = readGoogleCache(key)
  if (cached) return cached
  const fetchImpl = input.fetchImpl ?? fetch
  const events = []
  let pageToken = ''
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${API_BASE}/calendars/${encodeURIComponent(input.calendar.id)}/events`)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('timeMin', window.timeMin)
    url.searchParams.set('timeMax', window.timeMax)
    url.searchParams.set('maxResults', String(PAGE_SIZE))
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const body = await getJson(fetchImpl, url, input.accessToken)
    for (const item of Array.isArray(body.items) ? body.items : []) {
      const event = normalizeGoogleCalendarEvent(item, input.calendar)
      if (event) events.push(event)
    }
    pageToken = String(body.nextPageToken ?? '')
    if (!pageToken) break
  }
  writeGoogleCache(key, events)
  return events
}
