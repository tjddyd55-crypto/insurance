import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { registerServiceIntegrationsApi } from '../../apis/registerServiceIntegrationsApi.js'
import { loadScheduleEvents } from '../../schedule/scheduleQuery.js'
import { createFakeGoogle, createFakeIntegrationPool } from './googleIntegrationTestKit.js'
import { GOOGLE_CONNECT_ALLOWLIST_ENV, isGoogleConnectAllowed } from './googleOAuthConfig.js'
import { resetGoogleCacheForTest } from './googleUserCache.js'

const ENV_KEYS = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'SMS_CREDENTIALS_SECRET_KEY', 'NODE_ENV', 'RAILWAY_ENVIRONMENT', 'APP_ENV', GOOGLE_CONNECT_ALLOWLIST_ENV]
const savedEnv = {}
const realFetch = globalThis.fetch
const RANGE = { fromYmd: '2026-09-27', toYmd: '2026-11-07', todayYmd: '2026-10-02' }

describe('isGoogleConnectAllowed (검증 기간 허용 목록)', () => {
  const prod = { RAILWAY_ENVIRONMENT: 'production' }
  const dev = { RAILWAY_ENVIRONMENT: 'development' }
  const a = { id: '5C2D72A2-aaaa', username: 'QA-Binder-A' }
  const b = { id: 'bbbb', username: 'qa-binder-b' }

  it('운영에서 env 가 없으면 아무도 허용하지 않는다(실수로 전체 공개되지 않음)', () => {
    assert.equal(isGoogleConnectAllowed(a, prod), false)
    assert.equal(isGoogleConnectAllowed(a, { NODE_ENV: 'production' }), false)
  })

  it('운영이 아니면(DEV·로컬) env 가 없을 때 모두 허용', () => {
    assert.equal(isGoogleConnectAllowed(a, dev), true)
    assert.equal(isGoogleConnectAllowed(b, {}), true)
  })

  it('목록의 사용자 id 또는 아이디만 허용(대소문자 무시, 쉼표·공백 구분)', () => {
    const env = { ...prod, [GOOGLE_CONNECT_ALLOWLIST_ENV]: ' qa-binder-a , other;5c2d72a2-AAAA ' }
    assert.equal(isGoogleConnectAllowed(a, env), true)
    assert.equal(isGoogleConnectAllowed({ id: '5c2d72a2-aaaa' }, env), true)
    assert.equal(isGoogleConnectAllowed(b, env), false)
    assert.equal(isGoogleConnectAllowed(null, env), false)
    assert.equal(isGoogleConnectAllowed({ id: '', username: '' }, env), false)
    assert.equal(isGoogleConnectAllowed(b, { ...dev, [GOOGLE_CONNECT_ALLOWLIST_ENV]: 'qa-binder-a' }), false)
  })

  it('`*` 하나로 전체 허용', () => {
    assert.equal(isGoogleConnectAllowed(b, { ...prod, [GOOGLE_CONNECT_ALLOWLIST_ENV]: '*' }), true)
  })
})

describe('Google 연결 시작: 허용 목록 밖이면 서버가 403, 화면은 준비 중', () => {
  let pool
  let base
  let server

  function fakeRequireAuth(req, res, next) {
    const id = String(req.headers['x-test-user'] ?? '')
    if (!id) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    req.user = { id, username: String(req.headers['x-test-username'] ?? ''), gaId: 1, role: 'USER', customerTenantDbId: 1 }
    next()
  }

  before(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
    delete process.env.NODE_ENV
    delete process.env.APP_ENV
    process.env.RAILWAY_ENVIRONMENT = 'production'
    process.env[GOOGLE_CONNECT_ALLOWLIST_ENV] = 'qa-binder-a'
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://onefc.platform-assets.com/backend/service-integrations/google/callback'
    process.env.SMS_CREDENTIALS_SECRET_KEY = 'a'.repeat(64)
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
    globalThis.fetch = createFakeGoogle().fetchImpl
    pool = createFakeIntegrationPool({
      crmAgeRows: [{ owner: 'user-b', customer_id: 2, customer_name: 'B고객', phone: '', event_date: '2026-10-07', assignee_name: '' }],
    })
    const app = express()
    app.use(express.json())
    const router = express.Router()
    registerServiceIntegrationsApi(router, {
      pool,
      requireAuth: fakeRequireAuth,
      handleDbError: (error, _req, res) => res.status(500).json({ message: 'db', code: String(error?.message ?? '') }),
    })
    app.use('/backend/api', router)
    server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener))
    })
    base = `http://127.0.0.1:${server.address().port}`
  })

  async function api(user, username, method, path) {
    const response = await realFetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-test-user': user, 'x-test-username': username },
      body: method === 'POST' ? '{}' : undefined,
      redirect: 'manual',
    })
    return { status: response.status, body: await response.json(), headers: response.headers }
  }

  it('허용된 A 는 Google 동의 화면 주소를 받는다', async () => {
    const started = await api('user-a', 'qa-binder-a', 'POST', '/backend/api/service-integrations/google_calendar/connect')
    assert.equal(started.status, 200)
    assert.equal(new URL(started.body.data.url).hostname, 'accounts.google.com')
    assert.equal(pool.states.size, 1)
  })

  it('허용되지 않은 B 는 403 google_connect_not_ready, state·쿠키·Google 주소 없음', async () => {
    for (const key of ['google_calendar', 'google']) {
      const started = await api('user-b', 'qa-binder-b', 'POST', `/backend/api/service-integrations/${key}/connect`)
      assert.equal(started.status, 403)
      assert.equal(started.body.code, 'google_connect_not_ready')
      assert.equal(started.body.message, 'Google 연동 준비 중입니다.')
      assert.equal(started.headers.get('set-cookie'), null)
      assert.ok(!JSON.stringify(started.body).includes('accounts.google.com'))
    }
    assert.equal(pool.states.size, 0)
  })

  it('카드·status 는 사용자별 connectAllowed 를 준다', async () => {
    const cardOf = (body) => body.data.providers.find((p) => p.key === 'google_calendar')
    assert.equal(cardOf((await api('user-a', 'qa-binder-a', 'GET', '/backend/api/service-integrations')).body).connectAllowed, true)
    assert.equal(cardOf((await api('user-b', 'qa-binder-b', 'GET', '/backend/api/service-integrations')).body).connectAllowed, false)
    assert.equal((await api('user-b', 'qa-binder-b', 'GET', '/backend/api/service-integrations/google/status')).body.data.connectAllowed, false)
  })

  it('일정 관리: 허용 목록 밖이어도 CRM 일정은 그대로, Google 은 connectAllowed=false', async () => {
    const schedule = await loadScheduleEvents(pool, {
      userId: 'user-b',
      gaId: 1,
      viewer: { id: 'user-b', username: 'qa-binder-b' },
      ...RANGE,
      sources: ['google', 'google_task', 'insurance_age'],
    })
    assert.equal(schedule.google.connectAllowed, false)
    assert.equal(schedule.google.status, 'disconnected')
    assert.equal(schedule.sourceStatus.crm, 'ok')
    assert.ok(schedule.events.some((event) => event.customerName === 'B고객'))
  })
})
