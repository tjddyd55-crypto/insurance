import { addDaysYmd, seoulYmd } from '../lib/seoulCalendarDate.js'
import { asYmd } from '../reminders/reminderEvents.js'

export const SCHEDULE_SOURCES = [
  'google',
  'customer_alert',
  'car_expiry',
  'insurance_age',
  'personal',
]

const REMINDER_SOURCE = {
  special_date: 'customer_alert',
  car_expiry: 'car_expiry',
  insurance_age_date: 'insurance_age',
}

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
 * @param {Record<string, unknown>} reminder
 */
export function normalizeReminderScheduleEvent(reminder) {
  const source = REMINDER_SOURCE[reminder.type]
  const startDate = asYmd(reminder.startDate)
  if (!source || !startDate) {
    return null
  }
  const sourceId = reminder.sourceId == null || reminder.sourceId === ''
    ? String(reminder.customerId ?? '')
    : String(reminder.sourceId)
  return {
    id: String(reminder.id),
    source,
    sourceId,
    type: String(reminder.type),
    title: String(reminder.title ?? ''),
    startAt: startDate,
    endAt: startDate,
    allDay: true,
    customerId: Number(reminder.customerId) || null,
    customerName: String(reminder.customerName ?? ''),
    description: String(reminder.content ?? ''),
    status: 'confirmed',
    phone: String(reminder.phone ?? ''),
    htmlLink: null,
    etag: null,
    sourceDate: asYmd(reminder.sourceDate),
    sourceTitle: reminder.sourceTitle == null ? null : String(reminder.sourceTitle),
  }
}

/**
 * Google Calendar events.list item. 취소 건과 시작이 없는 건은 제외한다.
 * @param {Record<string, unknown>} item
 * @param {string} [calendarId]
 */
export function normalizeGoogleCalendarEvent(item, calendarId = 'primary') {
  if (!item || item.status === 'cancelled' || !item.id) {
    return null
  }
  const start = item.start && typeof item.start === 'object' ? item.start : {}
  const end = item.end && typeof item.end === 'object' ? item.end : {}
  const allDay = Boolean(start.date) && !start.dateTime
  const startAt = allDay ? asYmd(start.date) : String(start.dateTime ?? '').trim()
  if (!startAt) {
    return null
  }
  const endAt = allDay
    ? (asYmd(end.date) || startAt)
    : (String(end.dateTime ?? '').trim() || startAt)
  return {
    id: `google:${calendarId}:${item.id}`,
    source: 'google',
    sourceId: String(item.id),
    type: 'google_event',
    title: String(item.summary ?? '').trim() || '(제목 없음)',
    startAt,
    endAt,
    allDay,
    customerId: null,
    customerName: '',
    description: String(item.description ?? ''),
    status: String(item.status ?? 'confirmed'),
    phone: '',
    htmlLink: item.htmlLink ? String(item.htmlLink) : null,
    etag: item.etag ? String(item.etag) : null,
    sourceDate: null,
    sourceTitle: null,
  }
}

/**
 * @param {Record<string, unknown>} row
 */
export function normalizePersonalTodo(row) {
  const date = asYmd(row.due_date)
  if (!date || row.status === 'canceled') {
    return null
  }
  const time = String(row.due_time ?? '').slice(0, 5)
  const timed = /^\d{2}:\d{2}$/.test(time)
  const startAt = timed ? `${date}T${time}:00+09:00` : date
  return {
    id: `personal:${row.id}`,
    source: 'personal',
    sourceId: String(row.id),
    type: 'personal',
    title: String(row.title ?? '').trim() || '개인 일정',
    startAt,
    endAt: timed ? addHour(date, time) : date,
    allDay: !timed,
    customerId: null,
    customerName: '',
    description: String(row.description ?? ''),
    status: String(row.status ?? 'pending'),
    phone: '',
    htmlLink: null,
    etag: null,
    sourceDate: null,
    sourceTitle: null,
  }
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
  return events.filter((event) => allow.has(event.source))
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
  if (Number.isNaN(parsed.getTime())) {
    return scheduleEventStartYmd(event)
  }
  return seoulYmd(parsed)
}

/**
 * @param {string} date
 * @param {string} time HH:mm
 */
function addHour(date, time) {
  const [hour, minute] = time.split(':').map(Number)
  const total = hour * 60 + minute + 60
  const nextDate = total >= 24 * 60 ? addDaysYmd(date, 1) : date
  const remain = total % (24 * 60)
  const nextHour = String(Math.floor(remain / 60)).padStart(2, '0')
  const nextMinute = String(remain % 60).padStart(2, '0')
  return `${nextDate}T${nextHour}:${nextMinute}:00+09:00`
}
