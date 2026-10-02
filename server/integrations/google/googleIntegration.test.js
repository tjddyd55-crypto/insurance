import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { registerServiceIntegrationsApi } from '../../apis/registerServiceIntegrationsApi.js'
import { loadScheduleEvents } from '../../schedule/scheduleQuery.js'
import { loadGoogleCalendarSchedule } from '../googleCalendarAdapter.js'
import { createFakeGoogle, createFakeIntegrationPool } from './googleIntegrationTestKit.js'
import { consumeOAuthState, createOAuthState, hashOAuthToken } from './googleOAuthStateStore.js'
import { GOOGLE_CALENDAR_SCOPES } from './googleOAuthConfig.js'
import { googleCacheKey, googleCacheKeysForTest, resetGoogleCacheForTest } from './googleUserCache.js'
import { googleTimeWindow } from './googleCalendarApi.js'

const ENV_KEYS = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'SMS_CREDENTIALS_SECRET_KEY', 'NODE_ENV', 'RAILWAY_ENVIRONMENT', 'APP_ENV']
const savedEnv = {}
const realFetch = globalThis.fetch

function calendarMeta(id, extra = {}) {
  return { id, summary: id, accessRole: 'owner', timeZone: 'Asia/Seoul', ...extra }
}

function timedEvent(id, summary, start, end) {
  return { id, summary, status: 'confirmed', start: { dateTime: start }, end: { dateTime: end }, htmlLink: `https://www.google.com/calendar/event?eid=${id}` }
}

/** 로그인 사용자는 x-test-user 헤더로만 바뀐다(요청 바디·쿼리의 id 는 무시). */
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
  const base = `http://127.0.0.1:${server.address().port}`
  return { server, base }
}

describe('Google Calendar 연동 (USER 소유, 읽기 전용)', () => {
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
    process.env.SMS_CREDENTIALS_SECRET_KEY = 'a'.repeat(64)
  })

  after(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    globalThis.fetch = realFetch
  })

  beforeEach(async () => {
    if (server) server.close()
    resetGoogleCacheForTest()
    google = createFakeGoogle()
    google.addAccount('gA', 'alice@example.com', [
      { meta: calendarMeta('alice@example.com', { primary: true }), events: [
        timedEvent('a1', 'A 상담', '2026-10-02T09:00:00+09:00', '2026-10-02T10:00:00+09:00'),
        timedEvent('a2', 'A 회의', '2026-10-03T14:00:00+09:00', '2026-10-03T15:00:00+09:00'),
        { id: 'a3', summary: 'A 종일', start: { date: '2026-10-05' }, end: { date: '2026-10-06' } },
      ] },
      { meta: calendarMeta('team-a@group.calendar.google.com', { selected: true }), events: [
        timedEvent('t1', '팀 일정', '2026-10-04T11:00:00+09:00', '2026-10-04T12:00:00+09:00'),
      ] },
      { meta: calendarMeta('holiday@group.v.calendar.google.com'), events: [
        { id: 'h1', summary: '공휴일', start: { date: '2026-10-03' }, end: { date: '2026-10-04' } },
      ] },
    ])
    google.addAccount('gA2', 'alice.work@example.com', [
      { meta: calendarMeta('alice.work@example.com', { primary: true }), events: [] },
    ])
    google.addAccount('gB', 'bob@example.com', [
      { meta: calendarMeta('bob@example.com', { primary: true }), events: [
        timedEvent('b1', 'B 비밀 일정', '2026-10-02T09:00:00+09:00', '2026-10-02T10:00:00+09:00'),
      ] },
    ])
    globalThis.fetch = google.fetchImpl
    pool = createFakeIntegrationPool({
      crmAgeRows: [
        { owner: 'user-a', customer_id: 1, customer_name: 'A고객', phone: '', event_date: '2026-10-07', assignee_name: '' },
        { owner: 'user-b', customer_id: 2, customer_name: 'B고객', phone: '', event_date: '2026-10-07', assignee_name: '' },
      ],
    })
    ;({ server, base } = await startServer(pool))
  })

  after(() => {
    if (server) server.close()
  })

  async function api(user, method, path, { cookie, role } = {}) {
    const headers = { 'content-type': 'application/json' }
    if (user) headers['x-test-user'] = user
    if (role) headers['x-test-role'] = role
    if (cookie) headers.cookie = cookie
    const response = await realFetch(`${base}${path}`, { method, headers, body: method === 'POST' ? '{}' : undefined, redirect: 'manual' })
    const text = await response.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = text }
    return { status: response.status, body, text, headers: response.headers }
  }

  /** 사용자 브라우저가 연결 시작 → Google 동의 → callback 까지. */
  async function connect(user, sub, { useCookie = true, stateFrom } = {}) {
    const started = await api(stateFrom ?? user, 'POST', '/backend/api/service-integrations/google_calendar/connect')
    assert.equal(started.status, 200)
    const url = new URL(started.body.data.url)
    const setCookie = started.headers.get('set-cookie') ?? ''
    const cookie = setCookie.split(';')[0]
    const code = google.issueCode(sub)
    const callback = await api(null, 'GET', `/backend/service-integrations/google/callback?state=${encodeURIComponent(url.searchParams.get('state'))}&code=${code}`, { cookie: useCookie ? cookie : '' })
    return { started, url, setCookie, callback }
  }

  it('connect: 최소 scope, state, HttpOnly 바인딩 쿠키, Drive·쓰기 scope 없음', async () => {
    const { url, setCookie, callback } = await connect('user-a', 'gA')
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
    assert.deepEqual(url.searchParams.get('scope').split(' '), [...GOOGLE_CALENDAR_SCOPES])
    assert.equal(url.searchParams.get('scope').includes('drive'), false)
    assert.equal(url.searchParams.get('scope').includes('auth/calendar '), false)
    assert.equal(url.searchParams.get('access_type'), 'offline')
    assert.equal(url.searchParams.get('redirect_uri'), process.env.GOOGLE_OAUTH_REDIRECT_URI)
    assert.ok(url.searchParams.get('state').length >= 40)
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /SameSite=Lax/)
    assert.equal(callback.status, 302)
    assert.equal(callback.headers.get('location'), '/service-integrations?google=connected')
    const row = pool.integrations.get('user-a|google')
    assert.equal(row.owner_scope, 'USER')
    assert.equal(row.user_id, 'user-a')
    assert.equal(row.ga_id, null)
    assert.equal(row.provider_account_email, 'alice@example.com')
    assert.equal(row.credential_ciphertext.includes('refresh-'), false)
    assert.equal(row.credential_ciphertext.includes('access-'), false)
  })

  it('미설정이면 connect 409, 카드 상태 미설정', async () => {
    const saved = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET
    try {
      const started = await api('user-a', 'POST', '/backend/api/service-integrations/google_calendar/connect')
      assert.equal(started.status, 409)
      assert.equal(started.body.code, 'provider_unconfigured')
      const list = await api('user-a', 'GET', '/backend/api/service-integrations')
      const card = list.body.data.providers.find((item) => item.key === 'google_calendar')
      assert.equal(card.status, 'unconfigured')
      const status = await api('user-a', 'GET', '/backend/api/service-integrations/google/status')
      assert.equal(status.body.data.configured, false)
    } finally {
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = saved
    }
  })

  it('state 검증: 위조·재사용·만료·바인딩 쿠키 불일치는 저장하지 않는다', async () => {
    const forged = await api(null, 'GET', '/backend/service-integrations/google/callback?state=forged&code=x')
    assert.equal(forged.headers.get('location'), '/service-integrations?google=error&reason=state_invalid')

    const noCookie = await connect('user-a', 'gA', { useCookie: false })
    assert.equal(noCookie.callback.headers.get('location'), '/service-integrations?google=error&reason=session_mismatch')
    assert.equal(pool.integrations.size, 0)

    const reuse = await api(null, 'GET', `/backend/service-integrations/google/callback?state=${encodeURIComponent(noCookie.url.searchParams.get('state'))}&code=x`, { cookie: noCookie.setCookie.split(';')[0] })
    assert.equal(reuse.headers.get('location'), '/service-integrations?google=error&reason=state_invalid')

    const created = await createOAuthState(pool, { userId: 'user-a', providerKey: 'google_calendar', now: Date.now() - 11 * 60 * 1000 })
    const expired = await consumeOAuthState(pool, { state: created.state, binding: created.binding, providerKey: 'google_calendar' })
    assert.deepEqual(expired, { ok: false, reason: 'state_expired' })

    const other = await createOAuthState(pool, { userId: 'user-a', providerKey: 'naver_calendar' })
    const wrongProvider = await consumeOAuthState(pool, { state: other.state, binding: other.binding, providerKey: 'google_calendar' })
    assert.deepEqual(wrongProvider, { ok: false, reason: 'state_invalid' })

    const stored = [...pool.states.values()]
    assert.ok(stored.every((row) => row.state_hash !== created.state && row.binding_hash !== created.binding))
    assert.equal(hashOAuthToken('x').length > 20, true)
  })

  it('다른 사용자에게 연결되는 것 차단: B 가 시작한 state 를 A 브라우저가 완료해도 저장 안 됨', async () => {
    const { callback } = await connect('user-a', 'gA', { stateFrom: 'user-b', useCookie: false })
    assert.match(callback.headers.get('location'), /reason=session_mismatch/)
    assert.equal(pool.integrations.has('user-b|google'), false)
    assert.equal(pool.integrations.has('user-a|google'), false)
  })

  it('사용자 A/B status·events 분리, B 는 A 일정을 볼 수 없다', async () => {
    await connect('user-a', 'gA')
    const statusA = await api('user-a', 'GET', '/backend/api/service-integrations/google/status')
    const statusB = await api('user-b', 'GET', '/backend/api/service-integrations/google/status')
    assert.equal(statusA.body.data.status, 'connected')
    assert.equal(statusA.body.data.accountEmail, 'alice@example.com')
    assert.ok(statusA.body.data.connectedAt)
    assert.equal(statusB.body.data.status, 'disconnected')
    assert.equal(statusB.body.data.accountEmail, '')
    assert.equal(/access-|refresh-|ciphertext/.test(statusA.text), false)

    const eventsB = await api('user-b', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    assert.equal(eventsB.status, 409)
    assert.equal(eventsB.body.code, 'not_connected')
    const calendarsB = await api('user-b', 'GET', '/backend/api/service-integrations/google/calendars')
    assert.equal(calendarsB.status, 409)

    await connect('user-b', 'gB')
    const eventsA = await api('user-a', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    const eventsB2 = await api('user-b', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    const titlesA = eventsA.body.data.events.map((event) => event.title)
    const titlesB = eventsB2.body.data.events.map((event) => event.title)
    assert.deepEqual(titlesA.sort(), ['A 상담', 'A 종일', 'A 회의', '팀 일정'].sort())
    assert.deepEqual(titlesB, ['B 비밀 일정'])
    assert.equal(/access-|refresh-/.test(eventsA.text), false)
  })

  it('A 가 B integration id·user id 를 넘겨도 B 연동에 접근 불가, GA 관리자도 열람 불가', async () => {
    await connect('user-b', 'gB')
    const bRow = pool.integrations.get('user-b|google')
    assert.ok(bRow)
    const leak = `integrationId=${encodeURIComponent(String(bRow.id ?? 'x'))}&userId=user-b&ownerScope=GA&gaId=1`
    for (const role of ['USER', 'GA_ADMIN', 'SUPER_ADMIN']) {
      const status = await api('user-a', 'GET', `/backend/api/service-integrations/google/status?${leak}`, { role })
      assert.equal(status.status, 200)
      assert.equal(status.body.data.status, 'disconnected')
      assert.equal(status.body.data.accountEmail, '')
      const calendars = await api('user-a', 'GET', `/backend/api/service-integrations/google/calendars?${leak}`, { role })
      assert.equal(calendars.status, 409)
      assert.equal(calendars.body.code, 'not_connected')
      const events = await api('user-a', 'GET', `/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31&${leak}`, { role })
      assert.equal(events.status, 409)
      assert.equal(/B 비밀 일정|bob@example.com/.test(events.text + calendars.text + status.text), false)
      const disconnect = await api('user-a', 'POST', `/backend/api/service-integrations/google_calendar/disconnect?${leak}`, { role })
      assert.equal(disconnect.status, 200)
      assert.equal(pool.integrations.has('user-b|google'), true)
    }
    assert.equal(google.revoked.length, 0)
  })

  it('B 의 disconnect 는 B 행만 지운다 (A 연결 유지)', async () => {
    await connect('user-a', 'gA')
    const result = await api('user-b', 'POST', '/backend/api/service-integrations/google_calendar/disconnect')
    assert.equal(result.status, 200)
    assert.equal(pool.integrations.has('user-a|google'), true)
    const statusA = await api('user-a', 'GET', '/backend/api/service-integrations/google/status')
    assert.equal(statusA.body.data.status, 'connected')
  })

  it('calendars: 정규화·pagination·기본 표시(primary+selected)', async () => {
    await connect('user-a', 'gA')
    const response = await api('user-a', 'GET', '/backend/api/service-integrations/google/calendars')
    const calendars = response.body.data.calendars
    assert.equal(calendars.length, 3)
    assert.deepEqual(Object.keys(calendars[0]).sort(), ['accessRole', 'defaultVisible', 'id', 'name', 'primary', 'selected', 'timezone'])
    assert.equal(calendars[0].primary, true)
    assert.equal(calendars.find((item) => item.id.startsWith('team-a')).defaultVisible, true)
    assert.equal(calendars.find((item) => item.id.startsWith('holiday')).defaultVisible, false)
    const listCalls = google.calls.filter((call) => call.url.includes('calendarList'))
    assert.equal(listCalls.length, 2)
  })

  it('events: 기간을 서울 자정 기준 UTC 로 보내고 pagination 을 끝까지 따른다, calendarIds 지정', async () => {
    await connect('user-a', 'gA')
    const response = await api('user-a', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31&calendarIds=holiday@group.v.calendar.google.com,alice@example.com')
    assert.equal(response.status, 200)
    const eventCalls = google.calls.filter((call) => call.url.includes('/events'))
    const first = new URL(eventCalls[0].url)
    assert.equal(first.searchParams.get('timeMin'), '2026-09-30T15:00:00.000Z')
    assert.equal(first.searchParams.get('timeMax'), '2026-10-31T15:00:00.000Z')
    assert.equal(first.searchParams.get('singleEvents'), 'true')
    assert.ok(eventCalls.some((call) => new URL(call.url).searchParams.get('pageToken') === 'e2'))
    const titles = response.body.data.events.map((event) => event.title).sort()
    assert.deepEqual(titles, ['A 상담', 'A 종일', 'A 회의', '공휴일'].sort())
    const allDay = response.body.data.events.find((event) => event.title === 'A 종일')
    assert.equal(allDay.allDay, true)
    assert.equal(allDay.startAt, '2026-10-05')
    assert.equal(allDay.endAt, '2026-10-06')
    const bad = await api('user-a', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-31&end=2026-10-01')
    assert.equal(bad.status, 400)
    assert.deepEqual(googleTimeWindow('2026-10-02', '2026-10-02'), { timeMin: '2026-10-01T15:00:00.000Z', timeMax: '2026-10-02T15:00:00.000Z' })
  })

  it('cache key 는 사용자별이고 해제 시 그 사용자 캐시만 지운다', async () => {
    await connect('user-a', 'gA')
    await connect('user-b', 'gB')
    await api('user-a', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    await api('user-b', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    const keys = googleCacheKeysForTest()
    assert.ok(keys.length >= 4)
    assert.ok(keys.every((key) => key.startsWith('google-events:user-a:') || key.startsWith('google-events:user-b:') || key === 'google-calendars:user-a' || key === 'google-calendars:user-b'))
    assert.equal(keys.some((key) => /^google-events:\d{4}-\d{2}/.test(key)), false)
    assert.throws(() => googleCacheKey('google-events', '', ['primary']), /owner_required/)
    const before = google.calls.length
    const again = await api('user-b', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    assert.deepEqual(again.body.data.events.map((event) => event.title), ['B 비밀 일정'])
    assert.equal(google.calls.length, before)
    await api('user-a', 'POST', '/backend/api/service-integrations/google_calendar/disconnect')
    const left = googleCacheKeysForTest()
    assert.equal(left.some((key) => key.includes(':user-a')), false)
    assert.equal(left.some((key) => key.includes(':user-b')), true)
  })

  it('같은 사용자 재연결(계정 교체)은 자기 행만 교체하고 이전 refresh token 을 revoke 한다', async () => {
    await connect('user-a', 'gA')
    await connect('user-b', 'gB')
    const before = google.revoked.length
    const bRowBefore = { ...pool.integrations.get('user-b|google') }
    const firstA = pool.integrations.get('user-a|google').credential_ciphertext
    await connect('user-a', 'gA2')
    const rowA = pool.integrations.get('user-a|google')
    assert.equal(rowA.provider_account_email, 'alice.work@example.com')
    assert.notEqual(rowA.credential_ciphertext, firstA)
    assert.equal([...pool.integrations.keys()].filter((key) => key.startsWith('user-a|')).length, 1)
    assert.equal(google.revoked.length, before + 1)
    assert.match(google.revoked.at(-1), /^refresh-gA-/)
    assert.deepEqual(pool.integrations.get('user-b|google'), bRowBefore)
  })

  it('disconnect: revoke 후 자기 credential 삭제, 이후 미연동', async () => {
    await connect('user-a', 'gA')
    const response = await api('user-a', 'POST', '/backend/api/service-integrations/google_calendar/disconnect')
    assert.equal(response.status, 200)
    assert.match(google.revoked.at(-1), /^refresh-gA-/)
    assert.equal(pool.integrations.has('user-a|google'), false)
    const status = await api('user-a', 'GET', '/backend/api/service-integrations/google/status')
    assert.equal(status.body.data.status, 'disconnected')
  })

  it('access token 만료 시 자동 refresh, refresh 폐기 시 needs_reauth + CRM 일정은 계속', async () => {
    await connect('user-a', 'gA')
    google.expireAccessTokens()
    const refreshed = await api('user-a', 'GET', '/backend/api/service-integrations/google/calendars')
    assert.equal(refreshed.status, 200)
    assert.ok(google.calls.some((call) => call.body.includes('grant_type=refresh_token')))

    resetGoogleCacheForTest()
    google.revoked.push(...google.accounts.get('gA').refresh)
    google.expireAccessTokens()
    const failed = await api('user-a', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    assert.equal(failed.status, 409)
    assert.equal(failed.body.code, 'needs_reauth')
    const status = await api('user-a', 'GET', '/backend/api/service-integrations/google/status')
    assert.equal(status.body.data.status, 'needs_reauth')
    const list = await api('user-a', 'GET', '/backend/api/service-integrations')
    assert.equal(list.body.data.providers.find((item) => item.key === 'google_calendar').status, 'needs_reauth')

    const schedule = await loadScheduleEvents(pool, { userId: 'user-a', gaId: 1, fromYmd: '2026-10-01', toYmd: '2026-10-31', sources: ['google', 'insurance_age'] })
    assert.equal(schedule.google.status, 'needs_reauth')
    assert.deepEqual(schedule.events.map((event) => event.customerName), ['A고객'])
  })

  it('Google API 장애여도 일정 관리는 CRM 일정을 돌려주고 Google 만 error', async () => {
    await connect('user-a', 'gA')
    google.setCalendarFailure(true)
    const schedule = await loadScheduleEvents(pool, { userId: 'user-a', gaId: 1, fromYmd: '2026-10-01', toYmd: '2026-10-31', sources: ['google', 'insurance_age'] })
    assert.equal(schedule.google.status, 'error')
    assert.equal(schedule.events.length, 1)
    assert.equal(schedule.events[0].type, 'insurance_age')
    google.setCalendarFailure(false)
    const ok = await loadScheduleEvents(pool, { userId: 'user-a', gaId: 1, fromYmd: '2026-10-01', toYmd: '2026-10-31', sources: ['google', 'insurance_age'] })
    assert.equal(ok.google.status, 'connected')
    assert.ok(ok.events.some((event) => event.source === 'google'))
    assert.ok(ok.google.calendars.length >= 1)
  })

  it('일정 관리: B 는 A 의 Google·CRM 일정을 받지 않는다', async () => {
    await connect('user-a', 'gA')
    const scheduleB = await loadScheduleEvents(pool, { userId: 'user-b', gaId: 1, fromYmd: '2026-10-01', toYmd: '2026-10-31', sources: ['google', 'insurance_age'] })
    assert.equal(scheduleB.google.status, 'disconnected')
    assert.deepEqual(scheduleB.events.map((event) => event.customerName), ['B고객'])
    const direct = await loadGoogleCalendarSchedule(pool, { userId: 'user-b', fromYmd: '2026-10-01', toYmd: '2026-10-31' })
    assert.deepEqual(direct.events, [])
  })

  it('모든 service_integrations 쿼리는 현재 사용자 id 를 첫 파라미터로 쓴다 (id 만으로 조회 없음)', async () => {
    await connect('user-a', 'gA')
    await api('user-a', 'GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-31')
    await api('user-b', 'GET', '/backend/api/service-integrations/google/status')
    const scoped = pool.queries.filter((query) => query.sql.includes(' service_integrations ') || query.sql.includes('service_integrations ('))
    assert.ok(scoped.length > 0)
    for (const query of scoped) {
      assert.ok(['user-a', 'user-b'].includes(query.params[0]), query.sql)
    }
  })

  it('비로그인은 status/calendars/events/connect/disconnect 모두 401', async () => {
    for (const [method, path] of [
      ['GET', '/backend/api/service-integrations/google/status'],
      ['GET', '/backend/api/service-integrations/google/calendars'],
      ['GET', '/backend/api/service-integrations/google/events?start=2026-10-01&end=2026-10-02'],
      ['POST', '/backend/api/service-integrations/google_calendar/connect'],
      ['POST', '/backend/api/service-integrations/google_calendar/disconnect'],
    ]) {
      const response = await api(null, method, path)
      assert.equal(response.status, 401, path)
    }
  })
})
