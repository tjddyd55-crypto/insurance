import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { registerScheduleApi, resetScheduleRefreshLimitForTest, takeScheduleRefreshSlot, SCHEDULE_REFRESH_MIN_INTERVAL_MS } from './registerScheduleApi.js'
import { googleCacheKey, googleCacheKeysForTest, resetGoogleCacheForTest, writeGoogleCache } from '../integrations/google/googleUserCache.js'

function fakeRequireAuth(req, res, next) {
  const id = String(req.headers['x-test-user'] ?? '')
  if (!id) return res.status(401).json({ message: '로그인이 필요합니다.' })
  req.user = { id, gaId: 1, role: 'USER', customerTenantDbId: 1 }
  next()
}

describe('일정 새로고침(refresh=1): 사용자 캐시만 비우고, 사용자별 10초 제한', () => {
  let server
  let base
  before(async () => {
    const app = express()
    const router = express.Router()
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) }
    registerScheduleApi(router, { pool, requireAuth: fakeRequireAuth, handleDbError: (e, _q, res) => res.status(500).json({ message: String(e?.message) }) })
    app.use('/backend/api', router)
    server = await new Promise((resolve) => { const l = app.listen(0, () => resolve(l)) })
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server.close())
  beforeEach(() => {
    resetGoogleCacheForTest()
    resetScheduleRefreshLimitForTest()
  })

  const get = (user, refresh) => fetch(`${base}/backend/api/schedule/events?from=2026-10-01&to=2026-10-31&sources=insurance_age${refresh ? '&refresh=1' : ''}`, { headers: { 'x-test-user': user } })

  it('일반 조회는 캐시를 유지하고 fetchedAt 을 돌려준다', async () => {
    writeGoogleCache(googleCacheKey('google-calendars', 'user-a'), [])
    const res = await get('user-a', false)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.data.cacheBypassed, false)
    assert.ok(!Number.isNaN(Date.parse(body.data.fetchedAt)))
    assert.deepEqual(googleCacheKeysForTest(), ['google-calendars:user-a'])
  })

  it('refresh=1 은 그 사용자 캐시만 지우고 cacheBypassed=true', async () => {
    writeGoogleCache(googleCacheKey('google-calendars', 'user-a'), [])
    writeGoogleCache(googleCacheKey('google-events', 'user-a', ['c', 'x', 'y']), [])
    writeGoogleCache(googleCacheKey('google-calendars', 'user-b'), [])
    const res = await get('user-a', true)
    assert.equal(res.status, 200)
    assert.equal((await res.json()).data.cacheBypassed, true)
    assert.deepEqual(googleCacheKeysForTest(), ['google-calendars:user-b'])
  })

  it('10초 안에 다시 refresh=1 은 429 + Retry-After, 다른 사용자·일반 조회는 영향 없음', async () => {
    assert.equal((await get('user-a', true)).status, 200)
    const limited = await get('user-a', true)
    assert.equal(limited.status, 429)
    const body = await limited.json()
    assert.equal(body.code, 'refresh_rate_limited')
    assert.ok(body.retryAfterSec >= 1 && body.retryAfterSec <= 10)
    assert.equal(limited.headers.get('retry-after'), String(body.retryAfterSec))
    assert.equal((await get('user-b', true)).status, 200)
    assert.equal((await get('user-a', false)).status, 200)
  })

  it('takeScheduleRefreshSlot: 간격이 지나면 다시 허용', () => {
    assert.equal(takeScheduleRefreshSlot('u', 1000), 0)
    assert.equal(takeScheduleRefreshSlot('u', 1000 + 4000), 6)
    assert.equal(takeScheduleRefreshSlot('u', 1000 + SCHEDULE_REFRESH_MIN_INTERVAL_MS), 0)
  })
})
