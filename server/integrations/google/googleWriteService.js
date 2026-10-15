/**
 * t307 Google Calendar·Tasks 쓰기. 모든 함수는 현재 로그인 사용자 id 와 그 사용자 자기 토큰으로만 동작한다.
 * - 기능 플래그(GOOGLE_WRITE_ENABLED)와 저장된 scope 를 매번 서버에서 확인한다.
 * - 대상 캘린더·목록·일정은 매번 Google 에서 다시 읽어 권한·안전성을 확인한다(화면 값은 믿지 않는다).
 * - 성공했을 때만 그 사용자 캐시를 지운다. 실패는 그대로 오류 code 로 올린다(가짜 성공 없음).
 * - 일정 생성은 클라이언트 requestId 로 만든 Google event id 를 써서 재시도·중복 클릭에도 한 건만 생긴다.
 */
import { addDaysYmd } from '../../lib/seoulCalendarDate.js'
import { readUserIntegration } from '../integrationStore.js'
import { normalizeGoogleCalendarEvent, googleEventEditability } from '../../schedule/scheduleEvents.js'
import { normalizeGoogleTask, normalizeGoogleTaskList } from '../../schedule/scheduleTasks.js'
import { googleGetJson, googleSendJson } from './googleApiHttp.js'
import {
  GOOGLE_ACCOUNT_PROVIDER_KEY,
  hasCalendarWriteScope,
  hasTasksWriteScope,
  isGoogleWriteEnabledFor,
} from './googleOAuthConfig.js'
import { googleError } from './googleTokenService.js'
import { clearGoogleUserCache } from './googleUserCache.js'
import { listGoogleCalendars } from './googleCalendarApi.js'

const CAL_BASE = 'https://www.googleapis.com/calendar/v3'
const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1'
const SEOUL = 'Asia/Seoul'
const YMD = /^\d{4}-\d{2}-\d{2}$/
const HM = /^([01]\d|2[0-3]):[0-5]\d$/
const REQUEST_ID = /^[0-9a-f]{32}$/
const TITLE_MAX = 300
const NOTES_MAX = 8000
const RECENT_TTL_MS = 10 * 60 * 1000

/** 같은 requestId 재요청(중복 클릭·재시도)에 같은 결과를 돌려준다. 키는 항상 사용자 id 로 시작. */
const recent = new Map()

function recentKey(userId, kind, requestId) {
  return `${String(userId)}:${kind}:${requestId}`
}

function readRecent(key, now = Date.now()) {
  const hit = recent.get(key)
  if (!hit) return undefined
  if (hit.expiresAt <= now) {
    recent.delete(key)
    return undefined
  }
  return hit.value
}

function writeRecent(key, value, now = Date.now()) {
  if (recent.size > 1000) recent.delete(recent.keys().next().value)
  recent.set(key, { expiresAt: now + RECENT_TTL_MS, value })
}

export function resetGoogleWriteMemoForTest() {
  recent.clear()
}

function invalid(field) {
  const error = googleError('invalid_input')
  error.field = field
  return error
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {'calendar' | 'tasks'} product
 * @param {Record<string, string | undefined>} [env]
 */
export async function assertGoogleWriteReady(pool, userId, product, env = process.env) {
  if (!isGoogleWriteEnabledFor(userId, env)) throw googleError('write_disabled')
  const row = await readUserIntegration(pool, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  if (!row) throw googleError('not_connected')
  if (row.status === 'error' && row.lastError === 'needs_reauth') throw googleError('needs_reauth')
  const scope = row.credential?.scope
  const ok = product === 'calendar' ? hasCalendarWriteScope(scope) : hasTasksWriteScope(scope)
  if (!ok) throw googleError('write_scope_missing')
  return row
}

/** @param {unknown} raw */
function cleanTitle(raw) {
  const title = String(raw ?? '').trim()
  if (!title) throw invalid('title')
  if (title.length > TITLE_MAX) throw invalid('title')
  return title
}

/** @param {unknown} raw */
function cleanNotes(raw) {
  const text = String(raw ?? '')
  if (text.length > NOTES_MAX) throw invalid('notes')
  return text.trim()
}

/** @param {unknown} raw */
export function eventIdFromRequestId(raw) {
  const id = String(raw ?? '').trim().toLowerCase().replace(/-/g, '')
  if (!REQUEST_ID.test(id)) throw invalid('requestId')
  // Google event id: base32hex(a-v, 0-9) 5~1024자. hex 는 그 부분집합이다.
  return `onefc${id}`
}

/**
 * 화면 입력 → Google start/end. 시간 일정은 서울 오프셋을 명시해 하루 밀림이 없다. 종일 end 는 exclusive.
 * @param {{ date?: unknown, endDate?: unknown, allDay?: unknown, startTime?: unknown, endTime?: unknown }} input
 */
export function googleEventTimes(input) {
  const date = String(input.date ?? '').trim()
  if (!YMD.test(date)) throw invalid('date')
  const endDate = String(input.endDate ?? '').trim() || date
  if (!YMD.test(endDate) || endDate < date) throw invalid('endDate')
  if (input.allDay === true) {
    return { start: { date }, end: { date: addDaysYmd(endDate, 1) } }
  }
  const startTime = String(input.startTime ?? '').trim()
  const endTime = String(input.endTime ?? '').trim()
  if (!HM.test(startTime)) throw invalid('startTime')
  if (!HM.test(endTime)) throw invalid('endTime')
  if (`${endDate}T${endTime}` <= `${date}T${startTime}`) throw invalid('endTime')
  return {
    start: { dateTime: `${date}T${startTime}:00+09:00`, timeZone: SEOUL },
    end: { dateTime: `${endDate}T${endTime}:00+09:00`, timeZone: SEOUL },
  }
}

/**
 * 사용자 calendarList 에서 쓰기 가능한(owner·writer) 캘린더만. 캐시 없이 읽는다.
 * @param {{ userId: string, accessToken: string, fetchImpl?: typeof fetch }} input
 */
export async function listWritableCalendars(input) {
  const calendars = await listGoogleCalendars({ ...input, useCache: false })
  return calendars.filter((calendar) => calendar.accessRole === 'owner' || calendar.accessRole === 'writer')
}

async function requireWritableCalendar(input, calendarId) {
  const id = String(calendarId ?? '').trim()
  if (!id) throw invalid('calendarId')
  const calendar = (await listWritableCalendars(input)).find((item) => item.id === id)
  if (!calendar) throw googleError('calendar_not_writable')
  return calendar
}

function eventUrl(calendarId, eventId) {
  const base = `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
  return new URL(eventId ? `${base}/${encodeURIComponent(eventId)}` : base)
}

/**
 * @param {{ userId: string, accessToken: string, fetchImpl?: typeof fetch }} access
 * @param {{ requestId: unknown, calendarId: unknown, title: unknown, description?: unknown, date?: unknown, endDate?: unknown, allDay?: unknown, startTime?: unknown, endTime?: unknown }} body
 */
export async function createGoogleCalendarEvent(access, body) {
  const fetchImpl = access.fetchImpl ?? fetch
  const eventId = eventIdFromRequestId(body.requestId)
  const memoKey = recentKey(access.userId, 'event', eventId)
  const memo = readRecent(memoKey)
  if (memo) return { ...memo, duplicate: true }
  const payload = {
    id: eventId,
    summary: cleanTitle(body.title),
    description: cleanNotes(body.description),
    ...googleEventTimes(body),
  }
  const calendar = await requireWritableCalendar(access, body.calendarId)
  let item
  let duplicate = false
  try {
    item = await googleSendJson(fetchImpl, 'POST', eventUrl(calendar.id), access.accessToken, { body: payload })
  } catch (error) {
    // 409: 같은 id 가 이미 있음(앞선 요청이 성공), 시간 초과: 결과 불명확 → 재생성하지 않고 id 로 확인.
    if (error?.code !== 'google_conflict' && error?.code !== 'google_timeout' && error?.code !== 'google_unavailable') throw error
    try {
      item = await googleGetJson(fetchImpl, eventUrl(calendar.id, eventId), access.accessToken)
      duplicate = true
    } catch {
      throw googleError(error.code === 'google_conflict' ? 'google_conflict' : 'google_result_unknown')
    }
    if (!item || item.status === 'cancelled') throw googleError('google_result_unknown')
  }
  clearGoogleUserCache(access.userId)
  const event = normalizeGoogleCalendarEvent(item, calendar)
  const result = { event, duplicate }
  writeRecent(memoKey, { event })
  return result
}

async function readSafeEvent(access, calendarId, eventId) {
  const calendar = await requireWritableCalendar(access, calendarId)
  const id = String(eventId ?? '').trim()
  if (!id) throw invalid('eventId')
  const item = await googleGetJson(access.fetchImpl ?? fetch, eventUrl(calendar.id, id), access.accessToken)
    .catch((error) => {
      if (error?.code === 'google_unavailable') throw googleError('google_not_found_or_unavailable')
      throw error
    })
  if (!item || item.status === 'cancelled') throw googleError('google_not_found')
  const editability = googleEventEditability(item, calendar)
  if (!editability.writable) {
    const error = googleError('event_read_only')
    error.reason = editability.readOnlyReason
    throw error
  }
  return { calendar, item }
}

/**
 * 제목·설명·날짜/시간·종일만 바꾼다(PATCH). 참석자·반복·회의 링크 등 다른 속성은 보내지 않는다. etag 로 동시 수정 충돌을 막는다.
 */
export async function updateGoogleCalendarEvent(access, calendarId, eventId, body) {
  const { calendar, item } = await readSafeEvent(access, calendarId, eventId)
  const patch = {
    summary: cleanTitle(body.title),
    description: cleanNotes(body.description),
    ...googleEventTimes(body),
  }
  // 종일↔시간 전환 시 반대쪽 필드를 명시적으로 비운다.
  if (patch.start.date) {
    patch.start.dateTime = null
    patch.end.dateTime = null
  } else {
    patch.start.date = null
    patch.end.date = null
  }
  const updated = await googleSendJson(access.fetchImpl ?? fetch, 'PATCH', eventUrl(calendar.id, item.id), access.accessToken, {
    body: patch,
    ifMatch: item.etag ? String(item.etag) : undefined,
  })
  clearGoogleUserCache(access.userId)
  return { event: normalizeGoogleCalendarEvent(updated, calendar) }
}

export async function deleteGoogleCalendarEvent(access, calendarId, eventId) {
  const { calendar, item } = await readSafeEvent(access, calendarId, eventId)
  try {
    await googleSendJson(access.fetchImpl ?? fetch, 'DELETE', eventUrl(calendar.id, item.id), access.accessToken, {
      ifMatch: item.etag ? String(item.etag) : undefined,
    })
  } catch (error) {
    if (error?.code !== 'google_not_found') throw error
  }
  clearGoogleUserCache(access.userId)
  return { deleted: true }
}

// ---------------- Tasks ----------------

async function requireTaskList(access, taskListId) {
  const id = String(taskListId ?? '').trim()
  if (!id) throw invalid('taskListId')
  const url = new URL(`${TASKS_BASE}/users/@me/lists/${encodeURIComponent(id)}`)
  const item = await googleGetJson(access.fetchImpl ?? fetch, url, access.accessToken).catch((error) => {
    if (error?.code === 'google_forbidden' || error?.code === 'google_unavailable') throw googleError('tasklist_not_found')
    throw error
  })
  const list = normalizeGoogleTaskList(item)
  if (!list) throw googleError('tasklist_not_found')
  return list
}

/**
 * Tasks due 는 날짜만 의미가 있다(시간은 버려짐). RFC3339 UTC 자정으로 보내고, 읽을 때 앞 10자만 쓴다.
 * @param {unknown} raw
 */
export function googleTaskDuePayload(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const date = String(raw).trim()
  if (!YMD.test(date)) throw invalid('dueDate')
  return `${date}T00:00:00.000Z`
}

function taskUrl(taskListId, taskId) {
  const base = `${TASKS_BASE}/lists/${encodeURIComponent(taskListId)}/tasks`
  return new URL(taskId ? `${base}/${encodeURIComponent(taskId)}` : base)
}

/**
 * Tasks 는 클라이언트 id 를 받지 않는다. 같은 requestId 는 메모리로 막고,
 * 시간 초과(결과 불명확)면 같은 제목·메모·예정일의 방금 만든 할 일이 있는지 확인한다.
 */
export async function createGoogleTask(access, body) {
  const fetchImpl = access.fetchImpl ?? fetch
  const requestId = String(body.requestId ?? '').trim().toLowerCase().replace(/-/g, '')
  if (!REQUEST_ID.test(requestId)) throw invalid('requestId')
  const memoKey = recentKey(access.userId, 'task', requestId)
  const memo = readRecent(memoKey)
  if (memo) return { ...memo, duplicate: true }
  const payload = {
    title: cleanTitle(body.title),
    notes: cleanNotes(body.notes),
    due: googleTaskDuePayload(body.dueDate),
  }
  if (!payload.due) delete payload.due
  const list = await requireTaskList(access, body.taskListId)
  const startedAt = Date.now()
  let item
  try {
    item = await googleSendJson(fetchImpl, 'POST', taskUrl(list.id), access.accessToken, { body: payload })
  } catch (error) {
    if (error?.code !== 'google_timeout' && error?.code !== 'google_unavailable') throw error
    const url = taskUrl(list.id)
    url.searchParams.set('showCompleted', 'true')
    url.searchParams.set('showHidden', 'true')
    url.searchParams.set('maxResults', '100')
    url.searchParams.set('updatedMin', new Date(startedAt - 2 * 60 * 1000).toISOString())
    const recentList = await googleGetJson(fetchImpl, url, access.accessToken).catch(() => {
      throw googleError('google_result_unknown')
    })
    item = (Array.isArray(recentList?.items) ? recentList.items : []).find((task) => task
      && String(task.title ?? '').trim() === payload.title
      && String(task.notes ?? '').trim() === payload.notes
      && String(task.due ?? '').slice(0, 10) === String(payload.due ?? '').slice(0, 10))
    if (!item) throw googleError('google_result_unknown')
  }
  clearGoogleUserCache(access.userId)
  const task = normalizeGoogleTask(item, list)
  writeRecent(memoKey, { task })
  return { task, duplicate: false }
}

async function readTask(access, taskListId, taskId) {
  const list = await requireTaskList(access, taskListId)
  const id = String(taskId ?? '').trim()
  if (!id) throw invalid('taskId')
  const item = await googleGetJson(access.fetchImpl ?? fetch, taskUrl(list.id, id), access.accessToken)
  if (!item || item.deleted === true) throw googleError('google_not_found')
  return { list, item }
}

/**
 * 제목·메모·예정일, 또는 완료/미완료만 바꾼다. 저장 후 Google 에서 다시 읽어 돌려준다.
 * @param {{ title?: unknown, notes?: unknown, dueDate?: unknown, completed?: unknown }} body
 */
export async function updateGoogleTask(access, taskListId, taskId, body) {
  const { list, item } = await readTask(access, taskListId, taskId)
  const patch = {}
  if (body.title !== undefined) patch.title = cleanTitle(body.title)
  if (body.notes !== undefined) patch.notes = cleanNotes(body.notes)
  if (body.dueDate !== undefined) patch.due = googleTaskDuePayload(body.dueDate)
  if (body.completed !== undefined) {
    if (body.completed === true) patch.status = 'completed'
    else if (body.completed === false) {
      patch.status = 'needsAction'
      patch.completed = null
    } else throw invalid('completed')
  }
  if (Object.keys(patch).length === 0) throw invalid('body')
  const fetchImpl = access.fetchImpl ?? fetch
  await googleSendJson(fetchImpl, 'PATCH', taskUrl(list.id, item.id), access.accessToken, { body: patch })
  clearGoogleUserCache(access.userId)
  const fresh = await googleGetJson(fetchImpl, taskUrl(list.id, item.id), access.accessToken)
  return { task: normalizeGoogleTask(fresh, list) }
}

export async function deleteGoogleTask(access, taskListId, taskId) {
  const { list, item } = await readTask(access, taskListId, taskId)
  try {
    await googleSendJson(access.fetchImpl ?? fetch, 'DELETE', taskUrl(list.id, item.id), access.accessToken)
  } catch (error) {
    if (error?.code !== 'google_not_found') throw error
  }
  clearGoogleUserCache(access.userId)
  return { deleted: true }
}

/**
 * 새 항목 추가 모달용: 쓰기 가능한 캘린더와 할 일 목록.
 */
export async function listGoogleWriteTargets(access, products) {
  const fetchImpl = access.fetchImpl ?? fetch
  const calendars = products.calendar ? await listWritableCalendars(access) : []
  let taskLists = []
  if (products.tasks) {
    const url = new URL(`${TASKS_BASE}/users/@me/lists`)
    url.searchParams.set('maxResults', '100')
    const body = await googleGetJson(fetchImpl, url, access.accessToken)
    taskLists = (Array.isArray(body?.items) ? body.items : []).map((item) => normalizeGoogleTaskList(item)).filter(Boolean)
  }
  return { calendars, taskLists }
}
