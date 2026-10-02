import { addDaysYmd, seoulYmd } from '../lib/seoulCalendarDate.js'
import { asYmd } from '../reminders/reminderEvents.js'

/**
 * 화면 필터 키. Google 은 source, CRM 은 type 으로 나뉜다.
 * (전체 = 아래 전부)
 */
export const SCHEDULE_SOURCES = [
  'google',
  'customer_alert',
  'car_expiry',
  'insurance_age',
]

const REMINDER_TYPE = {
  special_date: 'customer_alert',
  car_expiry: 'car_expiry',
  insurance_age_date: 'insurance_age',
}

const SEOUL_TIMEZONE = 'Asia/Seoul'

const MAX_RANGE_DAYS = 400

/**
 * @param {string} fromYmd
 * @param {string} toYmd
 */
export function assertScheduleRange(fromYmd, toYmd) {
  if (!asYmd(fromYmd) || !asYmd(toYmd) || fromYmd > toYmd) {
    const error = new Error('invalid_range')
    error.code = 'invalid_range'
    throw error
  }
  const [fromYear, fromMonth, fromDay] = fromYmd.split('-').map(Number)
  const [toYear, toMonth, toDay] = toYmd.split('-').map(Number)
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay)
  const days = Math.round((toUtc - fromUtc) / 86400000)
  if (days > MAX_RANGE_DAYS) {
    const error = new Error('range_too_wide')
    error.code = 'range_too_wide'
    throw error
  }
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseScheduleSources(raw) {
  const text = String(raw ?? '').trim()
  if (!text || text === 'all') {
    return [...SCHEDULE_SOURCES]
  }
  const parts = [...new Set(text.split(',').map((part) => part.trim()).filter(Boolean))]
  const unknown = parts.filter((part) => !SCHEDULE_SOURCES.includes(part))
  if (unknown.length > 0) {
    const error = new Error('invalid_source')
    error.code = 'invalid_source'
    throw error
  }
  return parts
}

/**
 * 기존 알림 집계(assembleReminderEvents) 결과를 공통 일정 모델로 바꾼다. 같은 쿼리를 다시 만들지 않는다.
 * 종일 일정의 endAt 은 Google 과 같이 exclusive(다음 날)다.
 * @param {Record<string, unknown>} reminder
 */
export function normalizeReminderScheduleEvent(reminder) {
  const type = REMINDER_TYPE[reminder.type]
  const startDate = asYmd(reminder.startDate)
  if (!type || !startDate) {
    return null
  }
  const sourceId = reminder.sourceId == null || reminder.sourceId === ''
    ? String(reminder.customerId ?? '')
    : String(reminder.sourceId)
  return {
    id: `crm:${String(reminder.id)}`,
    source: 'crm',
    sourceId,
    calendarId: null,
    calendarName: '',
    type,
    title: String(reminder.title ?? ''),
    description: String(reminder.content ?? ''),
    startAt: startDate,
    endAt: addDaysYmd(startDate, 1),
    allDay: true,
    timezone: SEOUL_TIMEZONE,
    customerId: Number(reminder.customerId) || null,
    customerName: String(reminder.customerName ?? ''),
    location: '',
    status: 'confirmed',
    readOnly: type !== 'customer_alert',
    phone: String(reminder.phone ?? ''),
    htmlLink: null,
    sourceDate: asYmd(reminder.sourceDate),
    sourceTitle: reminder.sourceTitle == null ? null : String(reminder.sourceTitle),
  }
}

/**
 * Google 이 준 링크만, https Google Calendar 주소일 때만 남긴다.
 * @param {unknown} raw
 */
export function safeGoogleHtmlLink(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return null
  }
  try {
    const url = new URL(text)
    const calendarHost = url.hostname === 'calendar.google.com'
    const googleCalendarPath = url.hostname === 'www.google.com' && url.pathname.startsWith('/calendar')
    if (url.protocol !== 'https:' || url.username || url.password || !(calendarHost || googleCalendarPath)) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Google 설명은 HTML 이 섞여 온다. 화면에는 글자만 보낸다.
 * @param {unknown} raw
 */
export function plainGoogleDescription(raw) {
  return String(raw ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Google Calendar events.list item → 공통 모델. 취소 건과 시작이 없는 건은 버린다. 원본은 넘기지 않는다.
 * 종일: start.date/end.date 달력일 그대로(UTC 자정 변환 없음, end exclusive).
 * 시간: dateTime(오프셋 포함) 그대로. 화면은 Asia/Seoul formatter 로만 바꾼다.
 * @param {Record<string, any>} item
 * @param {{ id: string, name?: string, timezone?: string }} [calendar]
 */
export function normalizeGoogleCalendarEvent(item, calendar = { id: 'primary' }) {
  if (!item || item.status === 'cancelled' || !item.id) {
    return null
  }
  const start = item.start && typeof item.start === 'object' ? item.start : {}
  const end = item.end && typeof item.end === 'object' ? item.end : {}
  const allDay = Boolean(start.date) && !start.dateTime
  const startAt = allDay ? asYmd(start.date) : String(start.dateTime ?? '').trim()
  if (!startAt || (!allDay && Number.isNaN(new Date(startAt).getTime()))) {
    return null
  }
  const endAt = allDay
    ? (asYmd(end.date) || addDaysYmd(startAt, 1))
    : (String(end.dateTime ?? '').trim() || startAt)
  const calendarId = String(calendar.id ?? 'primary')
  return {
    id: `google:${calendarId}:${String(item.id)}`,
    source: 'google',
    sourceId: String(item.id),
    calendarId,
    calendarName: String(calendar.name ?? ''),
    type: 'google_event',
    title: String(item.summary ?? '').trim() || '(제목 없음)',
    description: plainGoogleDescription(item.description),
    startAt,
    endAt,
    allDay,
    timezone: String(start.timeZone ?? calendar.timezone ?? '') || SEOUL_TIMEZONE,
    customerId: null,
    customerName: '',
    location: String(item.location ?? '').trim(),
    status: String(item.status ?? 'confirmed'),
    readOnly: true,
    phone: '',
    htmlLink: safeGoogleHtmlLink(item.htmlLink),
    sourceDate: null,
    sourceTitle: null,
  }
}

/**
 * 필터 키: Google 은 'google', CRM 은 type.
 * @param {{ source?: unknown, type?: unknown }} event
 */
export function scheduleFilterKey(event) {
  return event.source === 'google' ? 'google' : String(event.type ?? '')
}

/**
 * 같은 id 는 한 번만 남긴다. 먼저 들어온 이벤트가 이긴다.
 * @param {Array<Array<Record<string, unknown> | null>>} groups
 */
export function mergeScheduleEvents(groups) {
  const seen = new Set()
  const events = []
  for (const group of groups) {
    for (const event of group) {
      if (!event || seen.has(event.id)) {
        continue
      }
      seen.add(event.id)
      events.push(event)
    }
  }
  return events
}

/**
 * @param {Array<Record<string, unknown>>} events
 * @param {string[]} sources
 */
export function filterScheduleBySources(events, sources) {
  const allow = new Set(sources)
  return events.filter((event) => allow.has(scheduleFilterKey(event)))
}

/**
 * 종일은 달력일 그대로, 시간이 있으면 Asia/Seoul 날짜로 겹침을 본다.
 * Google 종일 종료일은 exclusive 다.
 * @param {Record<string, unknown>} event
 * @param {string} fromYmd
 * @param {string} toYmd
 */
export function eventOverlapsRange(event, fromYmd, toYmd) {
  const start = scheduleEventStartYmd(event)
  const end = scheduleEventEndYmd(event)
  if (!start || !end) {
    return false
  }
  return start <= toYmd && end >= fromYmd
}

/**
 * @param {Record<string, unknown>} event
 */
export function scheduleEventStartYmd(event) {
  if (event.allDay) {
    return asYmd(event.startAt)
  }
  const parsed = new Date(String(event.startAt ?? ''))
  if (Number.isNaN(parsed.getTime())) {
    return asYmd(event.startAt)
  }
  return seoulYmd(parsed)
}

/**
 * @param {Record<string, unknown>} event
 */
export function scheduleEventEndYmd(event) {
  if (event.allDay) {
    const start = asYmd(event.startAt)
    const end = asYmd(event.endAt)
    if (!start) {
      return null
    }
    if (!end || end <= start) {
      return start
    }
    return addDaysYmd(end, -1)
  }
  const parsed = new Date(String(event.endAt || event.startAt || ''))
  const startMs = new Date(String(event.startAt ?? '')).getTime()
  if (Number.isNaN(parsed.getTime())) {
    return scheduleEventStartYmd(event)
  }
  // 끝이 정확히 자정이면 그 날은 포함하지 않는다(end exclusive).
  const endMs = parsed.getTime() > startMs ? parsed.getTime() - 1 : parsed.getTime()
  return seoulYmd(new Date(endMs))
}
