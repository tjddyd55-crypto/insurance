import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  createGoogleCalendarEvent,
  createGoogleTask,
  deleteGoogleCalendarEvent,
  eventIdFromRequestId,
  googleEventTimes,
  googleTaskDuePayload,
  resetGoogleWriteMemoForTest,
  updateGoogleCalendarEvent,
  updateGoogleTask,
} from './googleWriteService.js'
import { googleEventEditability } from '../../schedule/scheduleEvents.js'
import { buildGoogleAuthorizationUrl } from './googleTokenService.js'
import { hasCalendarWriteScope, hasTasksWriteScope, isGoogleWriteEnabled } from './googleOAuthConfig.js'
import { resetGoogleCacheForTest } from './googleUserCache.js'

const RID = '0123456789abcdef0123456789abcdef'

function json(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (body == null ? '' : JSON.stringify(body)) }
}

/** 순서대로 응답하는 fetch mock. 호출 기록을 남긴다. */
function fakeFetch(handlers) {
  const calls = []
  const impl = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ method, url: String(url), body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers })
    for (const handler of handlers) {
      const out = handler(method, String(url), init)
      if (out) return typeof out === 'function' ? out() : out
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
  return { impl, calls }
}

const calendarList = (method, url) => (method === 'GET' && url.includes('/users/me/calendarList')
  ? json(200, { items: [
    { id: 'primary-id', summary: '내 캘린더', accessRole: 'owner', primary: true },
    { id: 'holiday', summary: '대한민국 휴일', accessRole: 'reader' },
  ] })
  : null)

afterEach(() => {
  resetGoogleWriteMemoForTest()
  resetGoogleCacheForTest()
})

describe('google write scopes / flag', () => {
  it('최소 쓰기 scope 와 기능 플래그', () => {
    assert.equal(hasCalendarWriteScope('https://www.googleapis.com/auth/calendar.readonly'), false)
    assert.equal(hasCalendarWriteScope('https://www.googleapis.com/auth/calendar.events'), true)
    assert.equal(hasTasksWriteScope('https://www.googleapis.com/auth/tasks.readonly'), false)
    assert.equal(hasTasksWriteScope('https://www.googleapis.com/auth/tasks'), true)
    assert.equal(isGoogleWriteEnabled({}), false)
    assert.equal(isGoogleWriteEnabled({ GOOGLE_WRITE_ENABLED: 'true' }), true)
  })
  it('쓰기 동의 URL 은 증분 동의(include_granted_scopes)·같은 계정 힌트·쓰기 scope 포함', () => {
    const url = new URL(buildGoogleAuthorizationUrl({ clientId: 'c', redirectUri: 'https://x/cb' }, 's', { purpose: 'write', loginHint: 'a@b.c' }))
    const scope = url.searchParams.get('scope')
    assert.match(scope, /calendar\.readonly/)
    assert.match(scope, /calendar\.events/)
    assert.match(scope, /auth\/tasks( |$)/)
    assert.equal(url.searchParams.get('include_granted_scopes'), 'true')
    assert.equal(url.searchParams.get('access_type'), 'offline')
    assert.equal(url.searchParams.get('login_hint'), 'a@b.c')
    const read = new URL(buildGoogleAuthorizationUrl({ clientId: 'c', redirectUri: 'https://x/cb' }, 's'))
    assert.doesNotMatch(read.searchParams.get('scope'), /calendar\.events/)
  })
})

describe('google calendar write', () => {
  it('KST 시간·종일(end exclusive) 변환', () => {
    assert.deepEqual(googleEventTimes({ date: '2026-10-20', startTime: '09:00', endTime: '10:30' }), {
      start: { dateTime: '2026-10-20T09:00:00+09:00', timeZone: 'Asia/Seoul' },
      end: { dateTime: '2026-10-20T10:30:00+09:00', timeZone: 'Asia/Seoul' },
    })
    assert.deepEqual(googleEventTimes({ date: '2026-10-31', allDay: true }), { start: { date: '2026-10-31' }, end: { date: '2026-11-01' } })
    assert.throws(() => googleEventTimes({ date: '2026-10-20', startTime: '10:00', endTime: '09:00' }), { code: 'invalid_input' })
  })
  it('requestId → 결정적 event id(base32hex)', () => {
    assert.equal(eventIdFromRequestId('01234567-89ab-cdef-0123-456789abcdef'), `onefc${RID}`)
    assert.throws(() => eventIdFromRequestId('nope'), { code: 'invalid_input' })
  })
  it('읽기 전용 캘린더에는 저장하지 않는다', async () => {
    const { impl, calls } = fakeFetch([calendarList])
    await assert.rejects(createGoogleCalendarEvent({ userId: 'u1', accessToken: 't', fetchImpl: impl }, {
      requestId: RID, calendarId: 'holiday', title: 'x', date: '2026-10-20', allDay: true,
    }), { code: 'calendar_not_writable' })
    assert.equal(calls.some((call) => call.method === 'POST'), false)
  })
  it('생성 후 같은 requestId 재요청은 Google 을 다시 부르지 않는다(중복 방지)', async () => {
    const { impl, calls } = fakeFetch([calendarList, (method) => (method === 'POST'
      ? json(200, { id: `onefc${RID}`, summary: 'A', start: { date: '2026-10-20' }, end: { date: '2026-10-21' }, organizer: { self: true } })
      : null)])
    const access = { userId: 'u1', accessToken: 't', fetchImpl: impl }
    const input = { requestId: RID, calendarId: 'primary-id', title: 'A', date: '2026-10-20', allDay: true }
    const first = await createGoogleCalendarEvent(access, input)
    assert.equal(first.event.sourceId, `onefc${RID}`)
    const post = calls.find((call) => call.method === 'POST')
    assert.equal(post.body.id, `onefc${RID}`)
    const second = await createGoogleCalendarEvent(access, input)
    assert.equal(second.duplicate, true)
    assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
  })
  it('409(이미 있음)·시간 초과는 재생성하지 않고 id 로 확인한다', async () => {
    const { impl, calls } = fakeFetch([
      calendarList,
      (method) => (method === 'POST' ? json(409, {}) : null),
      (method, url) => (method === 'GET' && url.includes(`/events/onefc${RID}`)
        ? json(200, { id: `onefc${RID}`, summary: 'A', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } })
        : null),
    ])
    const out = await createGoogleCalendarEvent({ userId: 'u1', accessToken: 't', fetchImpl: impl }, {
      requestId: RID, calendarId: 'primary-id', title: 'A', date: '2026-10-20', allDay: true,
    })
    assert.equal(out.duplicate, true)
    assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
  })
  it('반복·참석자·회의·남의 일정은 읽기 전용', () => {
    const owner = { accessRole: 'owner' }
    assert.equal(googleEventEditability({ recurringEventId: 'r' }, owner).readOnlyReason, 'recurring')
    assert.equal(googleEventEditability({ attendees: [{ email: 'x', self: false }] }, owner).readOnlyReason, 'attendees')
    assert.equal(googleEventEditability({ hangoutLink: 'https://meet' }, owner).readOnlyReason, 'conference')
    assert.equal(googleEventEditability({ organizer: { self: false } }, owner).readOnlyReason, 'not_organizer')
    assert.equal(googleEventEditability({ eventType: 'birthday' }, owner).readOnlyReason, 'special_type')
    assert.equal(googleEventEditability({}, { accessRole: 'reader' }).readOnlyReason, 'calendar_read_only')
    assert.equal(googleEventEditability({ organizer: { self: true }, attendees: [{ self: true }] }, owner).writable, true)
  })
  it('수정은 허용 필드만 PATCH 하고 etag 를 보낸다, 읽기 전용 일정은 거절', async () => {
    const { impl, calls } = fakeFetch([
      calendarList,
      (method, url) => (method === 'GET' && url.endsWith('/events/ev1')
        ? json(200, { id: 'ev1', etag: '"e1"', summary: 'old', start: { date: '2026-10-20' }, end: { date: '2026-10-21' }, organizer: { self: true } })
        : null),
      (method, url) => (method === 'GET' && url.endsWith('/events/ev2')
        ? json(200, { id: 'ev2', recurringEventId: 'base', start: { date: '2026-10-20' } })
        : null),
      (method) => (method === 'PATCH'
        ? json(200, { id: 'ev1', summary: 'new', start: { dateTime: '2026-10-20T09:00:00+09:00' }, end: { dateTime: '2026-10-20T10:00:00+09:00' } })
        : null),
    ])
    const access = { userId: 'u1', accessToken: 't', fetchImpl: impl }
    const out = await updateGoogleCalendarEvent(access, 'primary-id', 'ev1', { title: 'new', date: '2026-10-20', startTime: '09:00', endTime: '10:00' })
    assert.equal(out.event.title, 'new')
    const patch = calls.find((call) => call.method === 'PATCH')
    assert.deepEqual(Object.keys(patch.body).sort(), ['description', 'end', 'start', 'summary'])
    assert.equal(patch.body.start.date, null)
    assert.equal(patch.headers['If-Match'], '"e1"')
    await assert.rejects(updateGoogleCalendarEvent(access, 'primary-id', 'ev2', { title: 'x', date: '2026-10-20', allDay: true }), { code: 'event_read_only' })
    await assert.rejects(deleteGoogleCalendarEvent(access, 'primary-id', 'ev2'), { code: 'event_read_only' })
  })
})

describe('google tasks write', () => {
  const listGet = (method, url) => (method === 'GET' && url.includes('/users/@me/lists/L1') ? json(200, { id: 'L1', title: '내 목록' }) : null)
  it('due 는 날짜만(UTC 자정 문자열), 읽으면 같은 날', () => {
    assert.equal(googleTaskDuePayload('2026-10-31'), '2026-10-31T00:00:00.000Z')
    assert.equal(googleTaskDuePayload(''), null)
    assert.throws(() => googleTaskDuePayload('10/31'), { code: 'invalid_input' })
  })
  it('생성·같은 requestId 중복 방지', async () => {
    const { impl, calls } = fakeFetch([listGet, (method) => (method === 'POST'
      ? json(200, { id: 'T1', title: 'A', due: '2026-10-31T00:00:00.000Z', status: 'needsAction' })
      : null)])
    const access = { userId: 'u1', accessToken: 't', fetchImpl: impl }
    const input = { requestId: RID, taskListId: 'L1', title: 'A', notes: '', dueDate: '2026-10-31' }
    const out = await createGoogleTask(access, input)
    assert.equal(out.task.dueDate, '2026-10-31')
    await createGoogleTask(access, input)
    assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
  })
  it('시간 초과면 방금 만든 같은 할 일을 찾고, 없으면 결과 불명확(재생성 안 함)', async () => {
    const abort = () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error }
    const { impl, calls } = fakeFetch([listGet, (method) => (method === 'POST' ? abort : null), (method) => (method === 'GET' ? json(200, { items: [] }) : null)])
    await assert.rejects(createGoogleTask({ userId: 'u1', accessToken: 't', fetchImpl: impl }, { requestId: RID, taskListId: 'L1', title: 'A' }), { code: 'google_result_unknown' })
    assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
  })
  it('완료/미완료 전환 후 다시 읽는다', async () => {
    let status = 'needsAction'
    const { impl, calls } = fakeFetch([
      listGet,
      (method, url) => (method === 'GET' && url.endsWith('/tasks/T1') ? () => json(200, { id: 'T1', title: 'A', status }) : null),
      (method, _url, init) => (method === 'PATCH' ? () => { status = JSON.parse(init.body).status; return json(200, {}) } : null),
    ])
    const access = { userId: 'u1', accessToken: 't', fetchImpl: impl }
    assert.equal((await updateGoogleTask(access, 'L1', 'T1', { completed: true })).task.status, 'completed')
    const out = await updateGoogleTask(access, 'L1', 'T1', { completed: false })
    assert.equal(out.task.status, 'open')
    assert.equal(calls.filter((call) => call.method === 'PATCH').at(-1).body.completed, null)
  })
  it('Google 실패는 그대로 오류(가짜 성공 없음)', async () => {
    const { impl } = fakeFetch([
      listGet,
      (method, url) => (method === 'GET' && url.endsWith('/tasks/T1') ? json(200, { id: 'T1', title: 'A' }) : null),
      (method) => (method === 'PATCH' ? json(500, {}) : null),
    ])
    await assert.rejects(updateGoogleTask({ userId: 'u1', accessToken: 't', fetchImpl: impl }, 'L1', 'T1', { title: 'B' }), { code: 'google_unavailable' })
  })
})
