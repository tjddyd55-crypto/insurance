/**
 * ONE FC 일정. 기존 calendar_items 컬럼만 쓴다.
 * 소유는 owner_type='user' + owner_id. 소프트 삭제는 이미 있는 deleted_at.
 * requestId 가 있으면 (사용자, requestId) 해시로 id 를 정해 컬럼 추가 없이 재시도를 한 행으로 묶는다.
 * Google 쓰기 성공 여부와 저장은 분리된다.
 */
import crypto from 'node:crypto'
import { addDaysYmd, seoulYmd } from '../lib/seoulCalendarDate.js'
import { googleEventTimes } from '../integrations/google/googleWriteService.js'

const REQUEST_ID = /^[0-9a-f]{32}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TITLE_MAX = 300
const NOTES_MAX = 8000
const SEOUL = 'Asia/Seoul'

/**
 * @param {string} field
 */
function invalid(field) {
  const error = new Error('invalid_input')
  error.code = 'invalid_input'
  error.status = 400
  error.field = field
  return error
}

/**
 * @param {unknown} userId
 * @param {unknown} requestId 32 hex. 없으면 무작위 id(멱등 없음).
 */
export function scheduleIdForRequest(userId, requestId) {
  const raw = String(requestId ?? '').trim().toLowerCase().replace(/-/g, '')
  if (!raw) return crypto.randomUUID()
  if (!REQUEST_ID.test(raw)) throw invalid('requestId')
  const hex = crypto.createHash('sha256').update(`onefc-schedule:${userId}:${raw}`).digest('hex').slice(0, 32)
  const variant = (8 + (Number.parseInt(hex[16], 16) % 4)).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/**
 * @param {unknown} raw
 */
export function parseScheduleUuid(raw) {
  const id = String(raw ?? '').trim().toLowerCase()
  if (!UUID_RE.test(id)) throw invalid('id')
  return id
}

/**
 * 화면 입력 → calendar_items start_at/end_at (서울 오프셋).
 * 종일 end 는 googleEventTimes 와 같이 exclusive.
 * @param {Record<string, unknown>} body
 */
export function parseOnefcScheduleInput(body) {
  const title = String(body?.title ?? '').trim()
  if (!title || title.length > TITLE_MAX) throw invalid('title')
  const description = String(body?.description ?? '')
  if (description.length > NOTES_MAX) throw invalid('description')
  const allDay = body?.allDay === true
  let times
  try {
    times = googleEventTimes({
      date: body?.date,
      endDate: body?.endDate,
      allDay,
      startTime: body?.startTime,
      endTime: body?.endTime,
    })
  } catch (error) {
    throw invalid(String(error?.field || 'date'))
  }
  const startAt = times.start.date ? `${times.start.date}T00:00:00+09:00` : times.start.dateTime
  const endAt = times.end.date ? `${times.end.date}T00:00:00+09:00` : times.end.dateTime
  return { title, description: description.trim(), allDay, startAt, endAt }
}

/**
 * @param {Date} date
 */
function seoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return pick
}

/**
 * @param {unknown} raw
 */
function asDate(raw) {
  const date = raw instanceof Date ? raw : new Date(String(raw ?? ''))
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * @param {Date} date
 */
export function seoulDateTimeOffset(date) {
  const pick = seoulParts(date)
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}+09:00`
}

/**
 * @param {Date} date
 */
export function seoulHm(date) {
  const pick = seoulParts(date)
  return `${pick('hour')}:${pick('minute')}`
}

/**
 * calendar_items 행 → 일정 화면 이벤트.
 * source 는 'google' 이라 기존 필터 키·배지·정렬 함수를 바꾸지 않는다.
 * origin='onefc' 로 Google 에서 태어난 일정과 수정 경로만 가른다.
 * @param {Record<string, unknown>} row
 */
export function normalizeOnefcScheduleEvent(row) {
  const id = String(row?.id ?? '').trim()
  const start = asDate(row?.start_at)
  const end = asDate(row?.end_at)
  if (!id || !start || !end) return null
  const allDay = row.all_day === true
  const startAt = allDay ? seoulYmd(start) : seoulDateTimeOffset(start)
  const endAt = allDay ? seoulYmd(end) : seoulDateTimeOffset(end)
  return {
    id: `onefc:${id}`,
    source: 'google',
    sourceId: id,
    calendarId: null,
    calendarName: 'ONE FC',
    type: 'google_event',
    title: String(row.title ?? '').trim() || '(제목 없음)',
    description: String(row.description ?? ''),
    startAt,
    endAt,
    allDay,
    timezone: SEOUL,
    customerId: null,
    customerName: '',
    location: '',
    status: 'confirmed',
    readOnly: false,
    phone: '',
    htmlLink: null,
    sourceDate: null,
    sourceTitle: null,
    writable: true,
    readOnlyReason: '',
    origin: 'onefc',
  }
}

/**
 * 자동 연동 desired item. 제목은 사용자가 입력한 그대로(대괄호 접두사 없음).
 * @param {Record<string, unknown>} row
 */
export function scheduleRowToAutoSyncItem(row) {
  const id = String(row?.id ?? '').trim()
  const start = asDate(row?.start_at)
  const end = asDate(row?.end_at)
  if (!id || !start || !end) return null
  const allDay = row.all_day === true
  const startYmd = seoulYmd(start)
  const endYmd = seoulYmd(end)
  const endDate = allDay ? addDaysYmd(endYmd, -1) : endYmd
  return {
    key: `schedule:${id}`,
    kind: 'schedule',
    sourceType: 'schedule',
    sourceId: id,
    date: startYmd,
    endDate: endDate < startYmd ? startYmd : endDate,
    allDay,
    startTime: allDay ? null : seoulHm(start),
    endTime: allDay ? null : seoulHm(end),
    name: String(row.title ?? ''),
    description: String(row.description ?? ''),
    completed: false,
  }
}

export const SCHEDULE_INSERT_SQL = `
  INSERT INTO calendar_items (
    id, ga_id, owner_type, owner_id, created_by,
    item_type, title, description, start_at, end_at, all_day,
    status, visibility
  ) VALUES (
    $1, $2, 'user', $3, $3,
    'schedule', $4, $5, $6::timestamptz, $7::timestamptz, $8,
    'pending', 'private'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id, title, description, all_day, start_at, end_at
`

export const SCHEDULE_SELECT_SQL = `
  SELECT id::text AS id, title, description, all_day, start_at, end_at
  FROM calendar_items
  WHERE id = $1::uuid AND owner_type = 'user' AND owner_id = $2 AND ga_id = $3
    AND item_type = 'schedule' AND deleted_at IS NULL
`

export const SCHEDULE_UPDATE_SQL = `
  UPDATE calendar_items
  SET title = $4, description = $5, start_at = $6::timestamptz, end_at = $7::timestamptz,
      all_day = $8, updated_at = NOW()
  WHERE id = $1::uuid AND owner_type = 'user' AND owner_id = $2 AND ga_id = $3
    AND item_type = 'schedule' AND deleted_at IS NULL
  RETURNING id::text AS id, title, description, all_day, start_at, end_at
`

export const SCHEDULE_DELETE_SQL = `
  UPDATE calendar_items
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = $1::uuid AND owner_type = 'user' AND owner_id = $2 AND ga_id = $3
    AND item_type = 'schedule' AND deleted_at IS NULL
  RETURNING id::text AS id
`

export const SCHEDULE_RANGE_SQL = `
  SELECT id::text AS id, title, description, all_day, start_at, end_at
  FROM calendar_items
  WHERE ga_id = $1 AND owner_type = 'user' AND owner_id = $2
    AND item_type = 'schedule' AND deleted_at IS NULL
    AND start_at < $4::timestamptz AND end_at > $3::timestamptz
  ORDER BY start_at ASC, title ASC
`

/**
 * @param {{ query: Function }} db
 * @param {{ userId: string, gaId: number }} scope
 * @param {Record<string, unknown>} body
 */
export async function createOnefcSchedule(db, scope, body) {
  const input = parseOnefcScheduleInput(body)
  const id = scheduleIdForRequest(scope.userId, body?.requestId)
  const inserted = await db.query(SCHEDULE_INSERT_SQL, [
    id, scope.gaId, scope.userId, input.title, input.description, input.startAt, input.endAt, input.allDay,
  ])
  if (inserted.rows[0]) {
    return { row: inserted.rows[0], duplicate: false }
  }
  const existing = await db.query(SCHEDULE_SELECT_SQL, [id, scope.userId, scope.gaId])
  if (!existing.rows[0]) {
    const error = new Error('schedule_conflict')
    error.code = 'schedule_conflict'
    error.status = 409
    throw error
  }
  return { row: existing.rows[0], duplicate: true }
}

/**
 * @param {{ query: Function }} db
 * @param {{ userId: string, gaId: number, id: string }} scope
 * @param {Record<string, unknown>} body
 */
export async function updateOnefcSchedule(db, scope, body) {
  const id = parseScheduleUuid(scope.id)
  const input = parseOnefcScheduleInput(body)
  const updated = await db.query(SCHEDULE_UPDATE_SQL, [
    id, scope.userId, scope.gaId, input.title, input.description, input.startAt, input.endAt, input.allDay,
  ])
  if (!updated.rows[0]) {
    const error = new Error('schedule_not_found')
    error.code = 'schedule_not_found'
    error.status = 404
    throw error
  }
  return updated.rows[0]
}

/**
 * @param {{ query: Function }} db
 * @param {{ userId: string, gaId: number, id: string }} scope
 */
export async function deleteOnefcSchedule(db, scope) {
  const id = parseScheduleUuid(scope.id)
  const deleted = await db.query(SCHEDULE_DELETE_SQL, [id, scope.userId, scope.gaId])
  if (!deleted.rows[0]) {
    const error = new Error('schedule_not_found')
    error.code = 'schedule_not_found'
    error.status = 404
    throw error
  }
  return deleted.rows[0]
}

/**
 * @param {{ query: Function }} db
 * @param {{ userId: string, gaId: number, fromYmd: string, toYmd: string }} scope
 */
export async function listOnefcScheduleRows(db, scope) {
  const fromIso = `${scope.fromYmd}T00:00:00+09:00`
  const toIso = `${addDaysYmd(scope.toYmd, 1)}T00:00:00+09:00`
  const listed = await db.query(SCHEDULE_RANGE_SQL, [scope.gaId, scope.userId, fromIso, toIso])
  return listed.rows
}
