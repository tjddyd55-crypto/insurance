import { randomUUID } from 'node:crypto'
import { addDaysYmd } from '../../lib/seoulCalendarDate.js'
import {
  ENQUEUE_OUTBOX_SQL,
  FIND_BY_REQUEST_SQL,
  FIND_OWNED_ANY_SQL,
  FIND_OWNED_SQL,
  INSERT_SQL,
  LIST_SQL,
  MARK_OUTBOX_ERROR_SQL,
  SOFT_DELETE_SQL,
  UPDATE_SQL,
} from './calendarItemSql.js'

/**
 * calendar_items / sync_outbox 테스트 더블.
 * 프로덕션 SQL 상수와 같은 문장만 받고, 소유자 조건은 그 문장의 파라미터로만 적용한다.
 */
export function createMemoryCalendarDb() {
  const state = {
    items: [],
    outbox: [],
    snapshot: null,
    clock: Date.parse('2026-10-22T00:00:00.000Z'),
  }

  async function query(sql, params = []) {
    if (sql === 'BEGIN') return begin(state)
    if (sql === 'COMMIT') return commit(state)
    if (sql === 'ROLLBACK') return rollback(state)
    const handler = handlers.get(sql)
    if (!handler) throw new Error(`unexpected SQL: ${String(sql).slice(0, 80)}`)
    return handler(state, params)
  }

  return {
    state,
    query,
    async connect() {
      return { query, release() {} }
    },
  }
}

/**
 * @param {{ clock: number }} state
 */
function now(state) {
  state.clock += 1000
  return new Date(state.clock).toISOString()
}

/**
 * @param {{ items: any[], outbox: any[], snapshot: any }} state
 */
function begin(state) {
  state.snapshot = {
    items: structuredClone(state.items),
    outbox: structuredClone(state.outbox),
  }
  return empty()
}

/**
 * @param {{ snapshot: any }} state
 */
function commit(state) {
  state.snapshot = null
  return empty()
}

/**
 * @param {{ items: any[], outbox: any[], snapshot: any }} state
 */
function rollback(state) {
  if (state.snapshot) {
    state.items = state.snapshot.items
    state.outbox = state.snapshot.outbox
    state.snapshot = null
  }
  return empty()
}

function empty() {
  return { rows: [], rowCount: 0 }
}

/**
 * @param {any[]} rows
 */
function ok(rows) {
  return { rows, rowCount: rows.length }
}

/**
 * @param {any} item
 * @param {any[]} outbox
 */
function withOutbox(item, outbox) {
  const link = outbox.find((row) => row.owner_user_id === item.owner_user_id && row.local_id === String(item.id))
  return {
    ...item,
    outbox_id: link?.id ?? null,
    outbox_op: link?.op ?? null,
    last_error_class: link?.last_error_class ?? null,
  }
}

const handlers = new Map([
  [INSERT_SQL, insertItem],
  [UPDATE_SQL, updateItem],
  [SOFT_DELETE_SQL, softDeleteItem],
  [FIND_OWNED_SQL, (state, params) => findItem(state, params, false)],
  [FIND_OWNED_ANY_SQL, (state, params) => findItem(state, params, true)],
  [FIND_BY_REQUEST_SQL, findByRequest],
  [LIST_SQL, listItems],
  [ENQUEUE_OUTBOX_SQL, enqueue],
  [MARK_OUTBOX_ERROR_SQL, markError],
])

/**
 * @param {{ items: any[], clock: number }} state
 * @param {unknown[]} params
 */
function insertItem(state, params) {
  const ownerUserId = String(params[1] ?? '')
  const requestId = params[15] ?? null
  if (!ownerUserId) throw new Error('owner_required')
  if (requestId && state.items.some((item) => item.owner_user_id === ownerUserId && item.request_id === requestId)) {
    const error = new Error('duplicate_request')
    error.code = '23505'
    throw error
  }
  const at = now(state)
  const item = {
    id: randomUUID(),
    ga_id: Number(params[0]),
    owner_user_id: ownerUserId,
    item_type: 'schedule',
    title: params[2],
    description: params[3] ?? '',
    all_day: Boolean(params[4]),
    start_at: params[5],
    end_at: params[6],
    start_date: params[7],
    end_date: params[8],
    timezone: params[9] || 'Asia/Seoul',
    recurrence: parseJson(params[10]),
    customer_id: params[11],
    location: params[12] ?? '',
    color: params[13],
    status: params[14],
    origin: 'onefc',
    version: 1,
    request_id: requestId,
    deleted_at: null,
    created_at: at,
    updated_at: at,
  }
  state.items.push(item)
  return ok([{ id: item.id, version: item.version }])
}

/**
 * @param {{ items: any[], clock: number }} state
 * @param {unknown[]} params
 */
function updateItem(state, params) {
  const item = ownedOpen(state, params[13], params[14], params[15])
  if (!item) return empty()
  item.title = params[0]
  item.description = params[1] ?? ''
  item.all_day = Boolean(params[2])
  item.start_at = params[3]
  item.end_at = params[4]
  item.start_date = params[5]
  item.end_date = params[6]
  item.timezone = params[7]
  item.recurrence = parseJson(params[8])
  item.customer_id = params[9]
  item.location = params[10] ?? ''
  item.color = params[11]
  item.status = params[12]
  item.version += 1
  item.updated_at = now(state)
  return ok([{ id: item.id, version: item.version }])
}

/**
 * @param {{ items: any[], clock: number }} state
 * @param {unknown[]} params
 */
function softDeleteItem(state, params) {
  const item = ownedOpen(state, params[0], params[1], params[2])
  if (!item) return empty()
  item.deleted_at = now(state)
  item.status = 'cancelled'
  item.version += 1
  item.updated_at = item.deleted_at
  return ok([{ id: item.id, version: item.version }])
}

/**
 * @param {{ items: any[], outbox: any[] }} state
 * @param {unknown[]} params
 * @param {boolean} includeDeleted
 */
function findItem(state, params, includeDeleted) {
  const item = state.items.find((row) => matchesOwned(row, params[0], params[1], params[2], includeDeleted))
  return ok(item ? [withOutbox(item, state.outbox)] : [])
}

/**
 * @param {{ items: any[], outbox: any[] }} state
 * @param {unknown[]} params
 */
function findByRequest(state, params) {
  const item = state.items.find((row) => (
    row.owner_user_id === String(params[0])
    && Number(row.ga_id) === Number(params[1])
    && row.request_id === params[2]
    && row.item_type === 'schedule'
  ))
  return ok(item ? [withOutbox(item, state.outbox)] : [])
}

/**
 * @param {{ items: any[], outbox: any[] }} state
 * @param {unknown[]} params
 */
function listItems(state, params) {
  const ownerUserId = String(params[0])
  const gaId = Number(params[1])
  const fromYmd = String(params[2])
  const toYmd = String(params[3])
  const rangeStart = String(params[4])
  const rangeEnd = String(params[5])
  const rows = state.items
    .filter((item) => item.owner_user_id === ownerUserId && Number(item.ga_id) === gaId)
    .filter((item) => item.deleted_at == null && item.item_type === 'schedule')
    .filter((item) => overlaps(item, fromYmd, toYmd, rangeStart, rangeEnd))
    .sort(compareItems)
    .slice(0, 500)
    .map((item) => withOutbox(item, state.outbox))
  return ok(rows)
}

/**
 * @param {{ outbox: any[], clock: number }} state
 * @param {unknown[]} params
 */
function enqueue(state, params) {
  const ownerUserId = String(params[0])
  const localId = String(params[1])
  const op = String(params[2])
  const version = Number(params[3])
  const existing = state.outbox.find((row) => row.owner_user_id === ownerUserId && row.local_id === localId)
  if (!existing) {
    const row = {
      id: randomUUID(),
      owner_user_id: ownerUserId,
      provider: 'google_calendar',
      local_type: 'calendar_item',
      local_id: localId,
      op,
      local_version: version,
      attempts: 0,
      last_error_class: null,
      last_error: null,
      updated_at: now(state),
    }
    state.outbox.push(row)
    return ok([{ id: row.id, op: row.op, local_version: row.local_version }])
  }
  if (existing.local_version > version) return ok([])
  existing.op = op
  existing.local_version = version
  existing.attempts = 0
  existing.last_error_class = null
  existing.last_error = null
  existing.updated_at = now(state)
  return ok([{ id: existing.id, op: existing.op, local_version: existing.local_version }])
}

/**
 * @param {{ outbox: any[], clock: number }} state
 * @param {unknown[]} params
 */
function markError(state, params) {
  const errorClass = String(params[0])
  const ownerUserId = String(params[1])
  const localId = String(params[2])
  const row = state.outbox.find((item) => item.owner_user_id === ownerUserId && item.local_id === localId)
  if (!row) return empty()
  row.last_error_class = errorClass
  row.updated_at = now(state)
  return ok([row])
}

/**
 * @param {{ items: any[] }} state
 * @param {unknown} id
 * @param {unknown} ownerUserId
 * @param {unknown} gaId
 */
function ownedOpen(state, id, ownerUserId, gaId) {
  return state.items.find((row) => matchesOwned(row, id, ownerUserId, gaId, false)) ?? null
}

/**
 * @param {any} row
 * @param {unknown} id
 * @param {unknown} ownerUserId
 * @param {unknown} gaId
 * @param {boolean} includeDeleted
 */
function matchesOwned(row, id, ownerUserId, gaId, includeDeleted) {
  if (String(row.id) !== String(id)) return false
  if (row.owner_user_id !== String(ownerUserId)) return false
  if (Number(row.ga_id) !== Number(gaId)) return false
  if (row.item_type !== 'schedule') return false
  if (!includeDeleted && row.deleted_at != null) return false
  return true
}

/**
 * @param {any} item
 * @param {string} fromYmd
 * @param {string} toYmd
 * @param {string} rangeStart
 * @param {string} rangeEnd
 */
function overlaps(item, fromYmd, toYmd, rangeStart, rangeEnd) {
  if (item.all_day) {
    const end = item.end_date || addDaysYmd(item.start_date, 1)
    return item.start_date <= toYmd && end > fromYmd
  }
  const start = Date.parse(item.start_at)
  const end = item.end_at ? Date.parse(item.end_at) : start + 1000
  return start < Date.parse(rangeEnd) && end > Date.parse(rangeStart)
}

/**
 * @param {any} left
 * @param {any} right
 */
function compareItems(left, right) {
  const a = left.all_day ? left.start_date : left.start_at
  const b = right.all_day ? right.start_date : right.start_at
  return String(a).localeCompare(String(b))
    || String(left.title).localeCompare(String(right.title), 'ko')
    || String(left.id).localeCompare(String(right.id))
}

/**
 * @param {unknown} value
 */
function parseJson(value) {
  if (value == null) return null
  if (typeof value === 'string') return JSON.parse(value)
  return value
}
