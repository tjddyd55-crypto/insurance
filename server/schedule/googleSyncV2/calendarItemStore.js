import { parseGaId } from '../../lib/parseGaId.js'
import { addDaysYmd } from '../../lib/seoulCalendarDate.js'
import { assertScheduleRange } from '../scheduleEvents.js'
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
import { CalendarItemInputError, parseCalendarItemCreate, parseCalendarItemPatch } from './calendarItemInput.js'

/**
 * Google 오류 본문·토큰은 저장하지 않는다.
 * @param {any} error
 */
export function safeErrorClass(error) {
  const raw = String(error?.errorClass ?? error?.code ?? '').trim()
  if (/^[a-z0-9_]{1,40}$/.test(raw)) return raw
  return 'google_push_failed'
}

/**
 * @param {{ userId?: unknown, gaId?: unknown }} actor
 */
function requireActor(actor) {
  const userId = String(actor?.userId ?? '').trim()
  const gaId = parseGaId(actor?.gaId)
  if (!userId || gaId == null) {
    throw new CalendarItemInputError('unauthorized', '로그인이 필요합니다.', 401)
  }
  return { userId, gaId }
}

function notFound() {
  return new CalendarItemInputError('not_found', '일정을 찾을 수 없습니다.', 404)
}

/**
 * @param {any} row
 */
export function mapCalendarItemRow(row) {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    gaId: Number(row.ga_id),
    itemType: 'schedule',
    title: row.title ?? '',
    description: row.description ?? '',
    allDay: Boolean(row.all_day),
    startDate: dateText(row.start_date),
    endDate: dateText(row.end_date),
    startAt: instantText(row.start_at),
    endAt: instantText(row.end_at),
    timezone: row.timezone || 'Asia/Seoul',
    recurrence: recurrenceValue(row.recurrence),
    customerId: row.customer_id == null ? null : Number(row.customer_id),
    location: row.location ?? '',
    color: row.color ?? null,
    status: row.status,
    origin: row.origin,
    version: Number(row.version),
    requestId: row.request_id ?? null,
    deletedAt: instantText(row.deleted_at),
    createdAt: instantText(row.created_at),
    updatedAt: instantText(row.updated_at),
    sync: {
      queued: Boolean(row.outbox_id),
      op: row.outbox_op ?? null,
      lastErrorClass: row.last_error_class ?? null,
    },
  }
}

/**
 * 날짜는 Date 로 옮기지 않고 앞 10자만 쓴다.
 * @param {unknown} value
 */
function dateText(value) {
  if (value == null || value === '') return null
  const head = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null
}

/**
 * @param {unknown} value
 */
function instantText(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  return String(value)
}

/**
 * @param {unknown} value
 */
function recurrenceValue(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

/**
 * @param {{ query: Function }} executor
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} sql
 * @param {unknown[]} params
 */
async function oneRow(executor, sql, params) {
  const result = await executor.query(sql, params)
  return result.rows[0] ?? null
}

/**
 * @param {{ query: Function }} executor
 * @param {{ userId: string, gaId: number }} actor
 * @param {string | null} requestId
 */
async function findByRequest(executor, actor, requestId) {
  if (!requestId) return null
  return oneRow(executor, FIND_BY_REQUEST_SQL, [actor.userId, actor.gaId, requestId])
}

/**
 * @param {{ query: Function }} executor
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} id
 * @param {boolean} includeDeleted
 */
async function findOwned(executor, actor, id, includeDeleted) {
  const sql = includeDeleted ? FIND_OWNED_ANY_SQL : FIND_OWNED_SQL
  return oneRow(executor, sql, [id, actor.userId, actor.gaId])
}

/**
 * @param {Record<string, any>} draft
 * @param {{ userId: string, gaId: number }} actor
 */
function insertParams(actor, draft) {
  return [
    actor.gaId,
    actor.userId,
    draft.title,
    draft.description,
    draft.allDay,
    draft.startAt,
    draft.endAt,
    draft.startDate,
    draft.endDate,
    draft.timezone,
    draft.recurrence == null ? null : JSON.stringify(draft.recurrence),
    draft.customerId,
    draft.location,
    draft.color,
    draft.status,
    draft.requestId,
  ]
}

/**
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} id
 * @param {Record<string, any>} draft
 */
function updateParams(actor, id, draft) {
  return [
    draft.title,
    draft.description,
    draft.allDay,
    draft.startAt,
    draft.endAt,
    draft.startDate,
    draft.endDate,
    draft.timezone,
    draft.recurrence == null ? null : JSON.stringify(draft.recurrence),
    draft.customerId,
    draft.location,
    draft.color,
    draft.status,
    id,
    actor.userId,
    actor.gaId,
  ]
}

/**
 * @param {{ query: Function }} tx
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} localId
 * @param {number} version
 * @param {'upsert' | 'delete'} op
 */
async function enqueueOutbox(tx, actor, localId, version, op) {
  await tx.query(ENQUEUE_OUTBOX_SQL, [actor.userId, String(localId), op, version])
}

/**
 * @param {any} error
 */
function isRequestConflict(error) {
  return error?.code === '23505'
}

/**
 * @param {{ transaction: Function, query: Function }} gateway
 * @param {{ userId: string, gaId: number }} actor
 * @param {Record<string, any>} draft
 */
async function insertCalendarItem(gateway, actor, draft) {
  try {
    return await gateway.transaction((tx) => insertInTransaction(tx, actor, draft))
  } catch (error) {
    if (!isRequestConflict(error) || !draft.requestId) throw error
    return replayRequest(gateway, actor, draft.requestId, error)
  }
}

/**
 * @param {{ query: Function }} tx
 * @param {{ userId: string, gaId: number }} actor
 * @param {Record<string, any>} draft
 */
async function insertInTransaction(tx, actor, draft) {
  const existing = await findByRequest(tx, actor, draft.requestId)
  if (existing) return { item: mapCalendarItemRow(existing), wrote: false, op: null }
  const inserted = await tx.query(INSERT_SQL, insertParams(actor, draft))
  const id = inserted.rows[0]?.id
  const version = Number(inserted.rows[0]?.version)
  if (!id || !Number.isInteger(version)) {
    throw new CalendarItemInputError('calendar_item_insert_failed', '일정을 저장하지 못했습니다.', 500)
  }
  await enqueueOutbox(tx, actor, id, version, 'upsert')
  const row = await findOwned(tx, actor, String(id), false)
  if (!row || row.owner_user_id !== actor.userId) throw notFound()
  return { item: mapCalendarItemRow(row), wrote: true, op: 'upsert' }
}

/**
 * @param {{ query: Function }} gateway
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} requestId
 * @param {any} error
 */
async function replayRequest(gateway, actor, requestId, error) {
  const existing = await findByRequest(gateway, actor, requestId)
  if (!existing || existing.owner_user_id !== actor.userId) throw error
  return { item: mapCalendarItemRow(existing), wrote: false, op: null }
}

/**
 * 커밋이 끝난 뒤에만 푸시를 시도한다. 기본 경로는 푸시 함수가 없다.
 * 실패는 outbox 분류 코드만 남기고, 로컬 행은 그대로 둔다.
 * @param {{ query: Function }} gateway
 * @param {{ userId: string, gaId: number }} actor
 * @param {{ item: Record<string, any>, wrote: boolean, op: string | null }} saved
 * @param {{ pushGoogle?: Function }} options
 */
async function finishWrite(gateway, actor, saved, options) {
  if (!saved.wrote || typeof options.pushGoogle !== 'function') return saved
  try {
    await options.pushGoogle({ item: saved.item, op: saved.op })
    return saved
  } catch (error) {
    const lastErrorClass = safeErrorClass(error)
    await recordPushFailure(gateway, actor, saved.item.id, lastErrorClass)
    return {
      ...saved,
      item: {
        ...saved.item,
        sync: { queued: true, op: saved.op, lastErrorClass },
      },
    }
  }
}

/**
 * @param {{ query: Function }} gateway
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} localId
 * @param {string} lastErrorClass
 */
async function recordPushFailure(gateway, actor, localId, lastErrorClass) {
  try {
    await gateway.query(MARK_OUTBOX_ERROR_SQL, [lastErrorClass, actor.userId, String(localId)])
  } catch {
    // 로컬 저장은 이미 커밋되었다. 분류 기록 실패로 응답을 실패시키지 않는다.
  }
}

/**
 * @param {{ transaction: Function, query: Function }} gateway
 * @param {{ userId?: unknown, gaId?: unknown }} actor
 * @param {Record<string, unknown>} body
 * @param {{ pushGoogle?: Function }} [options]
 */
export async function createCalendarItem(gateway, actor, body, options = {}) {
  const owner = requireActor(actor)
  const draft = parseCalendarItemCreate(body)
  const saved = await insertCalendarItem(gateway, owner, draft)
  return finishWrite(gateway, owner, saved, options)
}

/**
 * @param {{ transaction: Function, query: Function }} gateway
 * @param {{ userId?: unknown, gaId?: unknown }} actor
 * @param {string} id
 * @param {Record<string, unknown>} body
 * @param {{ pushGoogle?: Function }} [options]
 */
export async function updateCalendarItem(gateway, actor, id, body, options = {}) {
  const owner = requireActor(actor)
  const saved = await gateway.transaction((tx) => updateInTransaction(tx, owner, id, body))
  return finishWrite(gateway, owner, saved, options)
}

/**
 * @param {{ query: Function }} tx
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
async function updateInTransaction(tx, actor, id, body) {
  const current = await findOwned(tx, actor, id, false)
  if (!current || current.owner_user_id !== actor.userId) throw notFound()
  const patch = parseCalendarItemPatch(mapCalendarItemRow(current), body)
  if (!patch.changed) return { item: mapCalendarItemRow(current), wrote: false, op: null }
  const updated = await tx.query(UPDATE_SQL, updateParams(actor, id, patch.next))
  if ((updated.rowCount ?? updated.rows.length) < 1) throw notFound()
  await enqueueOutbox(tx, actor, id, Number(updated.rows[0].version), 'upsert')
  const row = await findOwned(tx, actor, id, false)
  if (!row || row.owner_user_id !== actor.userId) throw notFound()
  return { item: mapCalendarItemRow(row), wrote: true, op: 'upsert' }
}

/**
 * @param {{ transaction: Function, query: Function }} gateway
 * @param {{ userId?: unknown, gaId?: unknown }} actor
 * @param {string} id
 * @param {{ pushGoogle?: Function }} [options]
 */
export async function deleteCalendarItem(gateway, actor, id, options = {}) {
  const owner = requireActor(actor)
  const saved = await gateway.transaction((tx) => deleteInTransaction(tx, owner, id))
  return finishWrite(gateway, owner, saved, options)
}

/**
 * @param {{ query: Function }} tx
 * @param {{ userId: string, gaId: number }} actor
 * @param {string} id
 */
async function deleteInTransaction(tx, actor, id) {
  const updated = await tx.query(SOFT_DELETE_SQL, [id, actor.userId, actor.gaId])
  if ((updated.rowCount ?? updated.rows.length) < 1) throw notFound()
  await enqueueOutbox(tx, actor, id, Number(updated.rows[0].version), 'delete')
  const row = await findOwned(tx, actor, id, true)
  if (!row || row.owner_user_id !== actor.userId) throw notFound()
  return { item: mapCalendarItemRow(row), wrote: true, op: 'delete' }
}

/**
 * @param {{ query: Function }} gateway
 * @param {{ userId?: unknown, gaId?: unknown }} actor
 * @param {string} id
 */
export async function getCalendarItem(gateway, actor, id) {
  const owner = requireActor(actor)
  const row = await findOwned(gateway, owner, id, false)
  if (!row || row.owner_user_id !== owner.userId) throw notFound()
  return mapCalendarItemRow(row)
}

/**
 * @param {{ query: Function }} gateway
 * @param {{ userId?: unknown, gaId?: unknown }} actor
 * @param {{ fromYmd: string, toYmd: string }} range
 */
export async function listCalendarItems(gateway, actor, range) {
  const owner = requireActor(actor)
  assertScheduleRange(range.fromYmd, range.toYmd)
  const endExclusive = addDaysYmd(range.toYmd, 1)
  const result = await gateway.query(LIST_SQL, [
    owner.userId,
    owner.gaId,
    range.fromYmd,
    range.toYmd,
    `${range.fromYmd}T00:00:00+09:00`,
    `${endExclusive}T00:00:00+09:00`,
  ])
  return result.rows.map(mapCalendarItemRow)
}
