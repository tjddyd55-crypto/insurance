import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { registerServiceIntegrationsApi } from '../../apis/registerServiceIntegrationsApi.js'
import { listTodosForSchedule } from '../../apis/todosApi.js'
import { loadScheduleEvents } from '../../schedule/scheduleQuery.js'
import {
  googleTaskDueDate,
  isOverdueTask,
  normalizeGoogleTask,
  normalizeOnefcTodo,
  selectScheduleTasks,
} from '../../schedule/scheduleTasks.js'
import { loadGoogleTasksForUser, loadGoogleTasksSchedule } from '../googleCalendarAdapter.js'
import { CALENDAR_ONLY_SCOPE, createFakeGoogle, createFakeIntegrationPool } from './googleIntegrationTestKit.js'
import { GOOGLE_OAUTH_SCOPES, GOOGLE_TASKS_READONLY_SCOPE, hasTasksReadScope } from './googleOAuthConfig.js'
import { clearGoogleUserCache, googleCacheKeysForTest, resetGoogleCacheForTest } from './googleUserCache.js'

const ENV_KEYS = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'SMS_CREDENTIALS_SECRET_KEY', 'NODE_ENV', 'RAILWAY_ENVIRONMENT', 'APP_ENV']
const savedEnv = {}
const realFetch = globalThis.fetch
const RANGE = { fromYmd: '2026-10-01', toYmd: '2026-10-31', todayYmd: '2026-10-02' }

function fakeRequireAuth(req, res, next) {
  const id = String(req.headers['x-test-user'] ?? '')
  if (!id) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return
  }
  req.user = { id, gaId: 1, role: String(req.headers['x-test-role'] ?? 'USER'), customerTenantDbId: 1 }
  next()
}

async function startServer(pool) {
  const app = express()
  app.use(express.json())
  const router = express.Router()
  registerServiceIntegrationsApi(router, {
    pool,
    requireAuth: fakeRequireAuth,
    handleDbError: (error, _req, res) => res.status(500).json({ message: 'db', code: String(error?.message ?? '') }),
  })
  app.use('/backend', router)
  app.use('/backend/api', router)
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener))
  })
  return { server, base: `http://127.0.0.1:${server.address().port}` }
}

function calendarMeta(id, extra = {}) {
  return { id, summary: id, accessRole: 'owner', timeZone: 'Asia/Seoul', ...extra }
}

const ALICE_TASK_LISTS = [
  { meta: { id: 'L1', title: '업무' }, tasks: [
    { id: 't1', title: '서류 제출', due: '2026-10-03T00:00:00.000Z', status: 'needsAction', notes: '메모 1\n둘째 줄', updated: '2026-10-01T01:00:00.000Z' },
    { id: 't2', title: '완료한 일', due: '2026-10-05T00:00:00.000Z', status: 'completed', completed: '2026-10-04T08:00:00.000Z', hidden: true },
    { id: 't3', title: '날짜 없는 일', status: 'needsAction' },
    { id: 't4', title: '지난 일', due: '2026-09-20T00:00:00.000Z', status: 'needsAction' },
    { id: 't5', title: '하위 할 일', due: '2026-10-10T00:00:00.000Z', status: 'needsAction', parent: 't1' },
    { id: 't6', title: '오래된 완료', due: '2026-08-01T00:00:00.000Z', status: 'completed', completed: '2026-08-01T09:00:00.000Z' },
    { id: 't7', title: '삭제됨', due: '2026-10-07T00:00:00.000Z', status: 'needsAction', deleted: true },
  ] },
  { meta: { id: 'L2', title: '개인' }, tasks: [
    { id: 'p1', title: '장보기', due: '2026-10-31T00:00:00.000Z', status: 'needsAction' },
    { id: 'p2', title: '다음 달', due: '2026-11-15T00:00:00.000Z', status: 'needsAction' },
  ] },
  { meta: { id: 'L3', title: '빈 목록' }, tasks: [] },
]

describe('Google Tasks 읽기 전용 (같은 USER 연결, tasks.readonly)', () => {
  let google
  let pool
  let base
  let server

  before(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
    delete process.env.NODE_ENV
    delete process.env.RAILWAY_ENVIRONMENT
    delete process.env.APP_ENV
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://insurance-dev.up.railway.app/backend/service-integrations/google/callback'
    process.env.SMS_CREDENTIALS_SECRET_KEY = 'b'.repeat(64)
  })

  after(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    globalThis.fetch = realFetch
    if (server) server.close()
  })

  beforeEach(async () => {
    if (server) server.close()
    resetGoogleCacheForTest()
    google = createFakeGoogle()
    google.addAccount('gA', 'alice@example.com', [
      { meta: calendarMeta('alice@example.com', { primary: true }), events: [
        { id: 'a1', summary: 'A 상담', status: 'confirmed', start: { dateTime: '2026-10-02T09:00:00+09:00' }, end: { dateTime: '2026-10-02T10:00:00+09:00' } },
      ] },
    ], ALICE_TASK_LISTS)
    google.addAccount('gB', 'bob@example.com', [
      { meta: calendarMeta('bob@example.com', { primary: true }), events: [] },
    ], [{ meta: { id: 'BL', title: 'B 목록' }, tasks: [{ id: 'b1', title: 'B 비밀 할 일', due: '2026-10-03T00:00:00.000Z', status: 'needsAction', notes: 'B 메모' }] }])
    globalThis.fetch = google.fetchImpl
    pool = createFakeIntegrationPool({
      crmAgeRows: [
        { owner: 'user-a', customer_id: 1, customer_name: 'A고객', phone: '', event_date: '2026-10-07', assignee_name: '' },
      ],
    })
    ;({ server, base } = await startServer(pool))
  })

  async function api(user, method, path, { cookie } = {}) {
    const headers = { 'content-type': 'application/json' }
    if (user) headers['x-test-user'] = user
    if (cookie) headers.cookie = cookie
    const response = await realFetch(`${base}${path}`, { method, headers, body: method === 'POST' ? '{}' : undefined, redirect: 'manual' })
    const text = await response.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = text }
    return { status: response.status, body, text, headers: response.headers }
  }

  async function connect(user, sub, { scope } = {}) {
    const started = await api(user, 'POST', '/backend/api/service-integrations/google_calendar/connect')
    assert.equal(started.status, 200)
    const url = new URL(started.body.data.url)
    const cookie = (started.headers.get('set-cookie') ?? '').split(';')[0]
    const code = google.issueCode(sub, scope ? { scope } : {})
    const callback = await api(null, 'GET', `/backend/service-integrations/google/callback?state=${encodeURIComponent(url.searchParams.get('state'))}&code=${code}`, { cookie })
    return { url, callback }
  }

  const todoRow = (id, extra = {}) => ({ id, title: `할 일 ${id}`, description: '', dueDate: '2026-10-04', dueTime: null, status: 'pending', relatedEntityType: null, relatedEntityId: null, customerName: null, ...extra })

  it('동의 화면 scope: tasks.readonly 하나만 추가, 쓰기 scope(auth/tasks) 없음', async () => {
    const { url } = await connect('user-a', 'gA')
    const scopes = url.searchParams.get('scope').split(' ')
    assert.deepEqual(scopes, ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/tasks.readonly'])
    assert.deepEqual(scopes, [...GOOGLE_OAUTH_SCOPES])
    assert.equal(scopes.includes('https://www.googleapis.com/auth/tasks'), false)
    assert.equal(scopes.includes('https://www.googleapis.com/auth/calendar'), false)
    assert.equal(url.searchParams.get('include_granted_scopes'), 'true')
    assert.match(url.searchParams.get('prompt'), /consent/)
    assert.equal(hasTasksReadScope(`openid ${GOOGLE_TASKS_READONLY_SCOPE}`), true)
    assert.equal(hasTasksReadScope(CALENDAR_ONLY_SCOPE), false)
  })

  it('목록·할 일 pagination 을 끝까지 따르고 정규화한다 (원본 필드 없음)', async () => {
    await connect('user-a', 'gA')
    const response = await api('user-a', 'GET', '/backend/api/service-integrations/google/tasks?start=2026-10-01&end=2026-10-31')
    assert.equal(response.status, 200)
    const { taskLists, tasks } = response.body.data
    assert.deepEqual(taskLists, [{ id: 'L1', name: '업무' }, { id: 'L2', name: '개인' }, { id: 'L3', name: '빈 목록' }])
    const listCalls = google.calls.filter((call) => call.url.includes('/users/@me/lists') || call.url.includes('/users/%40me/lists'))
    assert.equal(listCalls.length, 2)
    const l1Calls = google.calls.filter((call) => call.url.includes('/lists/L1/tasks'))
    assert.equal(l1Calls.length, 4)
    const first = new URL(l1Calls[0].url)
    assert.equal(first.searchParams.get('showCompleted'), 'true')
    assert.equal(first.searchParams.get('showHidden'), 'true')
    assert.equal(first.searchParams.get('maxResults'), '100')
    assert.equal(first.hostname, 'tasks.googleapis.com')
    const titles = tasks.map((task) => task.title)
    assert.ok(titles.includes('서류 제출'))
    assert.ok(titles.includes('완료한 일'), 'hidden completed task is readable')
    assert.ok(titles.includes('날짜 없는 일'))
    assert.ok(titles.includes('하위 할 일'))
    assert.ok(titles.includes('장보기'))
    assert.equal(titles.includes('삭제됨'), false)
    assert.equal(titles.includes('다음 달'), false)
    assert.equal(titles.includes('오래된 완료'), false)
    const t1 = tasks.find((task) => task.title === '서류 제출')
    assert.deepEqual(Object.keys(t1).sort(), ['completedAt', 'customerId', 'customerName', 'dueDate', 'dueTime', 'id', 'notes', 'parentId', 'readOnly', 'source', 'sourceId', 'status', 'taskListId', 'taskListName', 'title', 'updatedAt'].sort())
    assert.equal(t1.id, 'google_task:L1:t1')
    assert.equal(t1.source, 'google_task')
    assert.equal(t1.taskListName, '업무')
    assert.equal(t1.dueDate, '2026-10-03')
    assert.equal(t1.dueTime, null)
    assert.equal(t1.notes, '메모 1\n둘째 줄')
    assert.equal(t1.status, 'open')
    assert.equal(t1.readOnly, true)
    const done = tasks.find((task) => task.title === '완료한 일')
    assert.equal(done.status, 'completed')
    assert.equal(done.completedAt, '2026-10-04T08:00:00.000Z')
    assert.equal(tasks.find((task) => task.title === '날짜 없는 일').dueDate, null)
    assert.equal(tasks.find((task) => task.title === '하위 할 일').parentId, 't1')
    assert.equal(/access-|refresh-|kind|tasks#/.test(response.text), false)
  })

  it('due 는 날짜만: 2026-10-03T00:00:00.000Z → 2026-10-03 (KST 에서 하루 밀리지 않음), 시간 없음', () => {
    assert.equal(googleTaskDueDate('2026-10-03T00:00:00.000Z'), '2026-10-03')
    assert.equal(googleTaskDueDate('2026-12-31T00:00:00Z'), '2026-12-31')
    assert.equal(googleTaskDueDate(''), null)
    assert.equal(googleTaskDueDate(undefined), null)
    assert.equal(googleTaskDueDate('not-a-date'), null)
    const task = normalizeGoogleTask({ id: 'x', title: '', due: '2026-10-03T00:00:00.000Z', status: 'needsAction' }, { id: 'L', name: '목록' })
    assert.equal(task.dueDate, '2026-10-03')
    assert.equal(task.title, '(제목 없음)')
    assert.equal(task.dueTime, null)
    assert.equal(normalizeGoogleTask({ id: 'y', deleted: true }, { id: 'L' }), null)
  })

  it('지난 할 일: 오늘 이전 미완료는 기간 밖이어도 포함, 완료는 제외', async () => {
    await connect('user-a', 'gA')
    const result = await loadGoogleTasksForUser(pool, { userId: 'user-a', ...RANGE })
    const overdue = result.tasks.filter((task) => isOverdueTask(task, RANGE.todayYmd))
    assert.deepEqual(overdue.map((task) => task.title), ['지난 일'])
    assert.equal(result.tasks.some((task) => task.title === '오래된 완료'), false)
    const picked = selectScheduleTasks([
      { dueDate: null, status: 'open' },
      { dueDate: '2026-09-30', status: 'completed' },
      { dueDate: '2026-09-30', status: 'open' },
      { dueDate: '2026-11-01', status: 'open' },
    ], RANGE)
    assert.deepEqual(picked, [{ dueDate: null, status: 'open' }, { dueDate: '2026-09-30', status: 'open' }])
  })

  it('A/B 분리: B 는 A 의 목록·할 일·이메일을 받지 못한다 (쿼리로 id 를 넘겨도)', async () => {
    await connect('user-a', 'gA')
    const leak = 'userId=user-a&integrationId=1&ownerScope=GA&gaId=1'
    const notConnected = await api('user-b', 'GET', `/backend/api/service-integrations/google/tasks?start=2026-10-01&end=2026-10-31&${leak}`)
    assert.equal(notConnected.status, 409)
    assert.equal(notConnected.body.code, 'not_connected')
    assert.equal(/서류 제출|업무|alice@example.com/.test(notConnected.text), false)
    const scheduleB = await loadScheduleEvents(pool, { userId: 'user-b', gaId: 1, ...RANGE, sources: ['google_task'] })
    assert.equal(scheduleB.google.tasks.status, 'disconnected')
    assert.deepEqual(scheduleB.tasks, [])

    await connect('user-b', 'gB')
    const tasksB = await api('user-b', 'GET', `/backend/api/service-integrations/google/tasks?start=2026-10-01&end=2026-10-31&${leak}`)
    assert.deepEqual(tasksB.body.data.tasks.map((task) => task.title), ['B 비밀 할 일'])
    assert.deepEqual(tasksB.body.data.taskLists, [{ id: 'BL', name: 'B 목록' }])
    const tasksA = await api('user-a', 'GET', '/backend/api/service-integrations/google/tasks?start=2026-10-01&end=2026-10-31')
    assert.equal(/B 비밀 할 일|B 목록|bob@example.com/.test(tasksA.text), false)
    const statusB = await api('user-b', 'GET', '/backend/api/service-integrations/google/status')
    assert.equal(statusB.body.data.accountEmail, 'bob@example.com')
  })

  it('cache 키는 사용자·목록·기간/상태를 포함하고 사용자끼리 섞이지 않는다', async () => {
    await connect('user-a', 'gA')
    await connect('user-b', 'gB')
    await loadGoogleTasksForUser(pool, { userId: 'user-a', ...RANGE })
    await loadGoogleTasksForUser(pool, { userId: 'user-b', ...RANGE })
    const keys = googleCacheKeysForTest().filter((key) => key.startsWith('google-task'))
    assert.ok(keys.includes('google-tasklists:user-a'))
    assert.ok(keys.includes('google-tasklists:user-b'))
    assert.ok(keys.includes('google-tasks:user-a:L1:due-any:status-all'))
    assert.ok(keys.includes('google-tasks:user-b:BL:due-any:status-all'))
    assert.equal(keys.some((key) => key.startsWith('google-tasks:user-b:L1')), false)
    const before = google.calls.length
    const again = await loadGoogleTasksForUser(pool, { userId: 'user-b', ...RANGE })
    assert.equal(google.calls.length, before)
    assert.deepEqual(again.tasks.map((task) => task.title), ['B 비밀 할 일'])
    clearGoogleUserCache('user-a')
    const left = googleCacheKeysForTest()
    assert.equal(left.some((key) => key.includes(':user-a')), false)
    assert.ok(left.some((key) => key.startsWith('google-tasks:user-b:')))
  })

  it('Tasks 장애는 Calendar·CRM·ONE FC 할 일을 막지 않는다', async () => {
    await connect('user-a', 'gA')
    google.setTasksFailure(true)
    const schedule = await loadScheduleEvents(pool, {
      userId: 'user-a',
      gaId: 1,
      ...RANGE,
      sources: ['google', 'google_task', 'onefc_todo', 'insurance_age'],
      loadTodos: async () => [todoRow('11')],
    })
    assert.equal(schedule.sourceStatus.google_task, 'error')
    assert.equal(schedule.google.tasks.status, 'error')
    assert.equal(schedule.sourceStatus.google, 'connected')
    assert.equal(schedule.sourceStatus.crm, 'ok')
    assert.equal(schedule.sourceStatus.onefc_todo, 'ok')
    assert.ok(schedule.events.some((event) => event.title === 'A 상담'))
    assert.ok(schedule.events.some((event) => event.customerName === 'A고객'))
    assert.deepEqual(schedule.tasks.map((task) => task.id), ['onefc_todo:11'])
    google.setTasksFailure(false)
    const ok = await loadScheduleEvents(pool, { userId: 'user-a', gaId: 1, ...RANGE, sources: ['google_task'] })
    assert.equal(ok.sourceStatus.google_task, 'connected')
    assert.ok(ok.tasks.some((task) => task.title === '서류 제출'))
    assert.equal(ok.events.length, 0)
  })

  it('ONE FC 할 일 실패도 Google·CRM 을 막지 않는다', async () => {
    await connect('user-a', 'gA')
    const realWarn = console.warn
    const warnings = []
    console.warn = (...args) => { warnings.push(JSON.stringify(args)) }
    let schedule
    try {
      schedule = await loadScheduleEvents(pool, {
        userId: 'user-a',
        gaId: 1,
        ...RANGE,
        sources: ['google', 'google_task', 'onefc_todo', 'insurance_age'],
        loadTodos: async () => { throw Object.assign(new Error('boom'), { code: 'ECONNRESET' }) },
      })
    } finally {
      console.warn = realWarn
    }
    assert.equal(schedule.sourceStatus.onefc_todo, 'error')
    assert.equal(schedule.sourceStatus.google_task, 'connected')
    assert.ok(schedule.tasks.some((task) => task.source === 'google_task'))
    assert.ok(schedule.events.some((event) => event.source === 'google'))
    assert.ok(schedule.events.some((event) => event.source === 'crm'))
    assert.equal(warnings.length, 1)
  })

  it('scope 없음(이전 Calendar 전용 동의): Tasks 는 재동의 필요, Calendar 는 계속, Google Tasks 호출 안 함', async () => {
    const { callback } = await connect('user-a', 'gA', { scope: CALENDAR_ONLY_SCOPE })
    assert.equal(callback.headers.get('location'), '/service-integrations?google=connected&reason=tasks_scope_missing')
    const status = await api('user-a', 'GET', '/backend/api/service-integrations/google/status')
    assert.equal(status.body.data.status, 'connected')
    assert.equal(status.body.data.calendarReadable, true)
    assert.equal(status.body.data.tasksReadable, false)
    assert.equal(status.body.data.needsReconsent, true)
    assert.deepEqual(status.body.data.products, {
      calendar: { status: 'available', scopeGranted: true, readOnly: true },
      tasks: { status: 'scope_missing', scopeGranted: false, needsReconsent: true, readOnly: true },
    })
    const list = await api('user-a', 'GET', '/backend/api/service-integrations')
    const card = list.body.data.providers.find((item) => item.key === 'google_calendar')
    assert.equal(card.name, 'Google')
    assert.equal(card.status, 'connected')
    assert.equal(card.needsReconsent, true)
    assert.equal(card.products.tasks.status, 'scope_missing')
    const tasks = await api('user-a', 'GET', '/backend/api/service-integrations/google/tasks?start=2026-10-01&end=2026-10-31')
    assert.equal(tasks.status, 409)
    assert.equal(tasks.body.code, 'scope_missing')
    assert.equal(tasks.body.needsReconsent, true)
    const schedule = await loadScheduleEvents(pool, { userId: 'user-a', gaId: 1, ...RANGE, sources: ['google', 'google_task'] })
    assert.equal(schedule.google.status, 'connected')
    assert.equal(schedule.google.tasks.status, 'scope_missing')
    assert.equal(schedule.google.tasks.needsReconsent, true)
    assert.ok(schedule.events.some((event) => event.title === 'A 상담'))
    assert.deepEqual(schedule.tasks, [])
    assert.equal(google.calls.some((call) => call.url.includes('tasks.googleapis.com')), false)

    // 재연결(같은 흐름)로 tasks.readonly 를 받으면 바로 읽힌다.
    await connect('user-a', 'gA')
    const upgraded = await api('user-a', 'GET', '/backend/api/service-integrations/google/status')
    assert.equal(upgraded.body.data.tasksReadable, true)
    assert.equal(upgraded.body.data.needsReconsent, false)
    assert.equal(upgraded.body.data.products.tasks.status, 'available')
    const direct = await loadGoogleTasksSchedule(pool, { userId: 'user-a', ...RANGE })
    assert.equal(direct.status, 'connected')
  })

  it('access token 만료 후 refresh 해도 tasks scope 가 유지된다', async () => {
    await connect('user-a', 'gA')
    google.expireAccessTokens()
    const result = await loadGoogleTasksForUser(pool, { userId: 'user-a', ...RANGE })
    assert.ok(result.tasks.length > 0)
    assert.ok(google.calls.some((call) => call.body.includes('grant_type=refresh_token')))
  })

  it('disconnect: credential 삭제·revoke·Tasks 캐시 삭제, 이후 할 일이 사라진다', async () => {
    await connect('user-a', 'gA')
    await connect('user-b', 'gB')
    await loadGoogleTasksForUser(pool, { userId: 'user-a', ...RANGE })
    await loadGoogleTasksForUser(pool, { userId: 'user-b', ...RANGE })
    assert.ok(googleCacheKeysForTest().some((key) => key.startsWith('google-tasks:user-a:')))
    const response = await api('user-a', 'POST', '/backend/api/service-integrations/google_calendar/disconnect')
    assert.equal(response.status, 200)
    assert.match(google.revoked.at(-1), /^refresh-gA-/)
    assert.equal(pool.integrations.has('user-a|google'), false)
    const keys = googleCacheKeysForTest()
    assert.equal(keys.some((key) => key.includes(':user-a')), false)
    assert.ok(keys.some((key) => key.startsWith('google-tasks:user-b:')))
    const schedule = await loadScheduleEvents(pool, { userId: 'user-a', gaId: 1, ...RANGE, sources: ['google', 'google_task'], loadTodos: async () => [todoRow('21')] })
    assert.equal(schedule.google.tasks.status, 'disconnected')
    assert.deepEqual(schedule.tasks, [])
    const tasks = await api('user-a', 'GET', '/backend/api/service-integrations/google/tasks?start=2026-10-01&end=2026-10-31')
    assert.equal(tasks.status, 409)
    assert.equal(tasks.body.code, 'not_connected')
    const withTodos = await loadScheduleEvents(pool, { userId: 'user-a', gaId: 1, ...RANGE, sources: ['google_task', 'onefc_todo'], loadTodos: async () => [todoRow('21')] })
    assert.deepEqual(withTodos.tasks.map((task) => task.id), ['onefc_todo:21'], 'ONE FC 할 일은 Google 해제와 무관하게 유지')
  })

  it('비로그인은 /google/tasks 401', async () => {
    const response = await api(null, 'GET', '/backend/api/service-integrations/google/tasks?start=2026-10-01&end=2026-10-31')
    assert.equal(response.status, 401)
  })
})

describe('ONE FC 할 일 (기존 todos SSOT 재사용)', () => {
  it('normalizeOnefcTodo: 취소 제외, 완료/열림, 고객 연결, 메모', () => {
    assert.equal(normalizeOnefcTodo({ id: '1', status: 'canceled', title: 'x' }), null)
    const todo = normalizeOnefcTodo({
      id: '7',
      title: '고객 전화',
      description: '오후에',
      dueDate: '2026-10-05',
      dueTime: '14:30',
      status: 'completed',
      completedAt: '2026-10-05T06:00:00.000Z',
      relatedEntityType: 'customer',
      relatedEntityId: '42',
      customerName: '홍길동',
    })
    assert.equal(todo.id, 'onefc_todo:7')
    assert.equal(todo.source, 'onefc_todo')
    assert.equal(todo.status, 'completed')
    assert.equal(todo.dueDate, '2026-10-05')
    assert.equal(todo.dueTime, '14:30')
    assert.equal(todo.customerId, 42)
    assert.equal(todo.customerName, '홍길동')
    assert.equal(todo.notes, '오후에')
    assert.equal(normalizeOnefcTodo({ id: '8', status: 'pending', title: 'y', dueDate: null }).dueDate, null)
  })

  it('listTodosForSchedule: 기존 소유 규칙(owner 또는 assignee, 같은 GA)·고객 가시성·취소 제외를 쓴다', async () => {
    const queries = []
    const pool = {
      async query(text, params) {
        queries.push({ sql: String(text).replace(/\s+/g, ' '), params })
        return {
          rows: [{ id: 5, ga_id: 1, owner_user_id: 'user-a', title: '내 할 일', description: '', due_date: '2026-10-04', status: 'pending', related_entity_type: null, related_entity_id: null }],
          rowCount: 1,
        }
      },
    }
    const todos = await listTodosForSchedule(pool, { user: { id: 'user-a', gaId: 1, customerTenantDbId: 1 } }, { userId: 'user-a', gaId: 1, ...RANGE })
    assert.equal(queries.length, 1)
    const { sql, params } = queries[0]
    assert.deepEqual(params, [1, 'user-a', '2026-10-01', '2026-10-31', '2026-10-02'])
    assert.match(sql, /t\.ga_id = \$1/)
    assert.match(sql, /t\.owner_user_id = \$2 OR t\.assignee_user_id = \$2/)
    assert.match(sql, /t\.status <> 'canceled'/)
    assert.match(sql, /t\.due_date IS NULL/)
    assert.match(sql, /related_entity_type IS DISTINCT FROM 'customer'/)
    assert.equal(todos[0].id, '5')
    assert.equal(todos[0].dueDate, '2026-10-04')
  })

  it('고객 열람 권한이 없는 세션이면 고객 연결 할 일은 SQL 에서 제외된다', async () => {
    const queries = []
    const pool = { async query(text, params) { queries.push({ sql: String(text), params }); return { rows: [], rowCount: 0 } } }
    await listTodosForSchedule(pool, { user: { id: 'user-a', gaId: 1, customerAccess: 'none' } }, { userId: 'user-a', gaId: 1, ...RANGE })
    assert.match(queries[0].sql.replace(/\s+/g, ' '), /t\.related_entity_type IS DISTINCT FROM 'customer' OR t\.related_entity_id IS NULL/)
    assert.equal(/EXISTS \(\s*SELECT 1 FROM customers/.test(queries[0].sql), false)
  })
})
