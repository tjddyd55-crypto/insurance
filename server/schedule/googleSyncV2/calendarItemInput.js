import { addDaysYmd } from '../../lib/seoulCalendarDate.js'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,80}$/
const TITLE_MAX = 500
const DESCRIPTION_MAX = 20000
const LOCATION_MAX = 500
const COLOR_MAX = 32
const TIMEZONE_MAX = 64
const RECURRENCE_MAX = 8000
const STATUSES = new Set(['pending', 'completed'])

export class CalendarItemInputError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   */
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'CalendarItemInputError'
    this.code = code
    this.status = status
  }
}

/**
 * @param {string} code
 * @param {string} message
 * @param {number} [status]
 */
function fail(code, message, status = 400) {
  return new CalendarItemInputError(code, message, status)
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} camel
 * @param {string} snake
 */
function readAlias(body, camel, snake) {
  const hasCamel = Object.prototype.hasOwnProperty.call(body, camel)
  const hasSnake = Object.prototype.hasOwnProperty.call(body, snake)
  if (!hasCamel && !hasSnake) return { present: false, value: undefined }
  if (hasCamel && hasSnake && stableJson(body[camel]) !== stableJson(body[snake])) {
    throw fail('invalid_body', '같은 값이 두 형식으로 다르게 왔습니다.')
  }
  return { present: true, value: hasCamel ? body[camel] : body[snake] }
}

/**
 * @param {unknown} value
 */
function stableJson(value) {
  return JSON.stringify(stableValue(value))
}

/**
 * @param {unknown} value
 */
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    return Object.fromEntries(entries)
  }
  return value ?? null
}

/**
 * @param {Record<string, unknown>} body
 */
function readItemType(body) {
  const read = readAlias(body, 'itemType', 'item_type')
  if (!read.present || read.value == null || read.value === '') return null
  return String(read.value).trim().toLowerCase()
}

/**
 * @param {Record<string, unknown>} body
 */
function assertScheduleItem(body) {
  const itemType = readItemType(body)
  if (itemType === 'todo') {
    throw fail('todo_uses_todos_table', '할 일은 기존 할 일 저장소를 사용합니다.')
  }
  if (itemType != null && itemType !== 'schedule') {
    throw fail('invalid_item_type', '일정 종류 값이 올바르지 않습니다.')
  }
}

/**
 * @param {unknown} value
 */
function requireTitle(value) {
  const title = String(value ?? '').trim()
  if (!title) throw fail('invalid_title', '제목을 입력해 주세요.')
  if (title.length > TITLE_MAX) throw fail('invalid_title', '제목이 너무 깁니다.')
  return title
}

/**
 * @param {unknown} value
 */
function readText(value, max, code, label) {
  if (value == null) return ''
  const text = String(value)
  if (text.length > max) throw fail(code, `${label}이 너무 깁니다.`)
  return text
}

/**
 * @param {unknown} value
 */
function readYmd(value, code) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  const head = text.slice(0, 10)
  if (!YMD.test(head) || text !== head) throw fail(code, '날짜는 YYYY-MM-DD 입니다.')
  return head
}

/**
 * @param {unknown} value
 */
function readDateTime(value, code) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!DATE_TIME.test(text)) throw fail(code, '시각은 시간대가 있는 ISO-8601 입니다.')
  return text
}

/**
 * @param {unknown} value
 */
function readRequestId(value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!REQUEST_ID.test(text)) throw fail('invalid_request_id', '요청 ID 형식이 올바르지 않습니다.')
  return text
}

/**
 * @param {unknown} value
 */
function readCustomerId(value) {
  if (value == null || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw fail('invalid_customer', '고객 ID 형식이 올바르지 않습니다.')
  return id
}

/**
 * @param {unknown} value
 */
function readRecurrence(value) {
  if (value == null) return null
  if (typeof value !== 'object') throw fail('invalid_recurrence', '반복 규칙 형식이 올바르지 않습니다.')
  const encoded = stableJson(value)
  if (encoded.length > RECURRENCE_MAX) throw fail('invalid_recurrence', '반복 규칙이 너무 깁니다.')
  return stableValue(value)
}

/**
 * @param {unknown} value
 * @param {boolean | null} fallback
 */
function readAllDay(value, fallback) {
  if (value == null) return fallback
  if (typeof value !== 'boolean') throw fail('invalid_all_day', '종일 여부는 true 또는 false 입니다.')
  return value
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function readStatus(value, fallback) {
  if (value == null || value === '') return fallback
  const status = String(value).trim().toLowerCase()
  if (!STATUSES.has(status)) throw fail('invalid_status', '상태 값이 올바르지 않습니다.')
  return status
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function readTimezone(value, fallback) {
  if (value == null || value === '') return fallback
  const text = String(value).trim()
  if (!text || text.length > TIMEZONE_MAX || /[\r\n]/.test(text)) {
    throw fail('invalid_timezone', '시간대 값이 올바르지 않습니다.')
  }
  return text
}

/**
 * @param {{
 *   allDay: boolean,
 *   startDate: string | null,
 *   endDate: string | null,
 *   startAt: string | null,
 *   endAt: string | null,
 * }} draft
 */
function normalizeWhen(draft) {
  if (draft.allDay) {
    if (!draft.startDate) throw fail('invalid_range', '종일 일정의 시작 날짜가 필요합니다.')
    const endDate = draft.endDate ?? addDaysYmd(draft.startDate, 1)
    if (endDate <= draft.startDate) throw fail('invalid_range', '종료 날짜는 시작 날짜보다 뒤여야 합니다.')
    return { ...draft, endDate, startAt: null, endAt: null }
  }
  if (!draft.startAt) throw fail('invalid_datetime', '시작 시각이 필요합니다.')
  if (draft.endAt && Date.parse(draft.endAt) < Date.parse(draft.startAt)) {
    throw fail('invalid_datetime', '종료 시각은 시작 시각보다 앞설 수 없습니다.')
  }
  return { ...draft, startDate: null, endDate: null }
}

/**
 * @param {Record<string, any>} base
 * @param {Record<string, unknown>} body
 * @param {{ create: boolean }} mode
 */
function applyBody(base, body, mode) {
  const title = readAlias(body, 'title', 'title')
  const description = readAlias(body, 'description', 'description')
  const allDay = readAlias(body, 'allDay', 'all_day')
  const startDate = readAlias(body, 'startDate', 'start_date')
  const endDate = readAlias(body, 'endDate', 'end_date')
  const startAt = readAlias(body, 'startAt', 'start_at')
  const endAt = readAlias(body, 'endAt', 'end_at')
  const timezone = readAlias(body, 'timezone', 'timezone')
  const recurrence = readAlias(body, 'recurrence', 'recurrence')
  const customerId = readAlias(body, 'customerId', 'customer_id')
  const location = readAlias(body, 'location', 'location')
  const color = readAlias(body, 'color', 'color')
  const status = readAlias(body, 'status', 'status')
  const requestId = readAlias(body, 'requestId', 'request_id')

  const nextAllDay = readAllDay(allDay.present ? allDay.value : null, mode.create ? null : base.allDay)
  if (nextAllDay == null) throw fail('invalid_all_day', '종일 여부는 true 또는 false 입니다.')

  return normalizeWhen({
    title: title.present ? requireTitle(title.value) : requireTitle(base.title),
    description: description.present ? readText(description.value, DESCRIPTION_MAX, 'invalid_description', '설명') : base.description,
    allDay: nextAllDay,
    startDate: startDate.present ? readYmd(startDate.value, 'invalid_range') : base.startDate,
    endDate: endDate.present ? readYmd(endDate.value, 'invalid_range') : base.endDate,
    startAt: startAt.present ? readDateTime(startAt.value, 'invalid_datetime') : base.startAt,
    endAt: endAt.present ? readDateTime(endAt.value, 'invalid_datetime') : base.endAt,
    timezone: readTimezone(timezone.present ? timezone.value : null, base.timezone || 'Asia/Seoul'),
    recurrence: recurrence.present ? readRecurrence(recurrence.value) : base.recurrence,
    customerId: customerId.present ? readCustomerId(customerId.value) : base.customerId,
    location: location.present ? readText(location.value, LOCATION_MAX, 'invalid_location', '장소').trim() : base.location,
    color: color.present ? emptyToNull(readText(color.value, COLOR_MAX, 'invalid_color', '색')) : base.color,
    status: readStatus(status.present ? status.value : null, mode.create ? 'pending' : base.status),
    requestId: mode.create ? readRequestId(requestId.present ? requestId.value : null) : base.requestId,
  })
}

/**
 * @param {string} value
 */
function emptyToNull(value) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function blankDraft() {
  return {
    title: '',
    description: '',
    allDay: null,
    startDate: null,
    endDate: null,
    startAt: null,
    endAt: null,
    timezone: 'Asia/Seoul',
    recurrence: null,
    customerId: null,
    location: '',
    color: null,
    status: 'pending',
    requestId: null,
  }
}

/**
 * 소유자·origin 은 본문에서 읽지 않는다.
 * @param {Record<string, unknown>} body
 */
export function parseCalendarItemCreate(body) {
  const source = body && typeof body === 'object' ? body : {}
  assertScheduleItem(source)
  const status = readAlias(source, 'status', 'status')
  if (status.present && String(status.value ?? '').trim().toLowerCase() !== 'pending') {
    throw fail('invalid_status', '새 일정은 진행 상태로만 만듭니다.')
  }
  return applyBody(blankDraft(), source, { create: true })
}

/**
 * @param {Record<string, any>} current
 * @param {Record<string, unknown>} body
 */
export function parseCalendarItemPatch(current, body) {
  const source = body && typeof body === 'object' ? body : {}
  assertScheduleItem(source)
  const next = applyBody(current, source, { create: false })
  return { changed: calendarContentKey(current) !== calendarContentKey(next), next }
}

/**
 * @param {Record<string, any>} item
 */
export function calendarContentKey(item) {
  return stableJson({
    title: item.title,
    description: item.description ?? '',
    allDay: Boolean(item.allDay),
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    startAt: item.startAt ?? null,
    endAt: item.endAt ?? null,
    timezone: item.timezone ?? 'Asia/Seoul',
    recurrence: item.recurrence ?? null,
    customerId: item.customerId ?? null,
    location: item.location ?? '',
    color: item.color ?? null,
    status: item.status,
  })
}
