import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { registerScheduleViewPrefsApi, validateScheduleViewPrefsPatch, sanitizeStoredScheduleViewPrefs } from './registerScheduleViewPrefsApi.js'

function fakeRequireAuth(req, res, next) {
  const id = String(req.headers['x-test-user'] ?? '')
  if (!id) return res.status(401).json({ message: '로그인이 필요합니다.' })
  req.user = { id, role: 'USER' }
  next()
}

/** user_schedule_view_prefs 만 흉내 — jsonb || 병합 */
function fakePool(store) {
  return {
    async query(sql, params) {
      if (/^SELECT prefs/.test(sql.trim())) {
        const row = store.get(params[0])
        return { rows: row ? [row] : [] }
      }
      if (/INSERT INTO user_schedule_view_prefs/.test(sql)) {
        const prev = store.get(params[0])?.prefs ?? {}
        const row = { prefs: { ...prev, ...JSON.parse(params[1]) }, updated_at: new Date().toISOString() }
        store.set(params[0], row)
        return { rows: [row] }
      }
      throw new Error(`unexpected sql: ${sql}`)
    },
  }
}

describe('일정 표시 설정 API (/me/schedule-view-prefs)', () => {
  let server
  let base
  const store = new Map()
  before(async () => {
    const app = express()
    app.use(express.json())
    const router = express.Router()
    registerScheduleViewPrefsApi(router, { pool: fakePool(store), requireAuth: fakeRequireAuth, handleDbError: (e, _q, res) => res.status(500).json({ message: String(e?.message) }) })
    app.use('/api', router)
    server = await new Promise((resolve) => { const l = app.listen(0, () => resolve(l)) })
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server.close())
  beforeEach(() => store.clear())

  const get = (user) => fetch(`${base}/api/me/schedule-view-prefs`, { headers: user ? { 'x-test-user': user } : {} })
  const patch = (user, prefs, extra = {}) => fetch(`${base}/api/me/schedule-view-prefs`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: JSON.stringify({ prefs, ...extra }),
  })

  it('인증 없음은 401', async () => {
    assert.equal((await get('')).status, 401)
    assert.equal((await patch('', { includeCompleted: true })).status, 401)
  })

  it('저장값 없으면 빈 prefs(서버 기본값 저장 없음)', async () => {
    const res = await get('user-a')
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).prefs, {})
    assert.equal(store.size, 0)
  })

  it('부분 업데이트는 병합되고 모두 OFF(빈 sources)도 보존', async () => {
    assert.equal((await patch('user-a', { sources: ['google', 'car_expiry'] })).status, 200)
    assert.equal((await patch('user-a', { includeCompleted: true })).status, 200)
    let body = await (await get('user-a')).json()
    assert.deepEqual(body.prefs, { sources: ['google', 'car_expiry'], includeCompleted: true })
    await patch('user-a', { sources: [] })
    body = await (await get('user-a')).json()
    assert.deepEqual(body.prefs, { sources: [], includeCompleted: true })
  })

  it('사용자 간 격리 — 바디의 userId 는 무시', async () => {
    await patch('user-a', { holidayMode: 'none' }, { userId: 'user-b' })
    assert.deepEqual((await (await get('user-b')).json()).prefs, {})
    assert.deepEqual((await (await get('user-a')).json()).prefs, { holidayMode: 'none' })
    assert.deepEqual([...store.keys()], ['user-a'])
  })

  it('허용 키 외·잘못된 값은 400, 저장 안 함', async () => {
    for (const bad of [{ foo: 1 }, { sources: ['nope'] }, { sources: 'google' }, { includeOverdue: 'yes' }, { holidayMode: 'us' }, { googleCalendarIds: [1] }, null, []]) {
      const res = await patch('user-a', bad)
      assert.equal(res.status, 400, JSON.stringify(bad))
    }
    assert.equal(store.size, 0)
  })
})

describe('validate/sanitize', () => {
  it('sources 정렬·중복 제거, calendarIds trim/null', () => {
    const r = validateScheduleViewPrefsPatch({ sources: ['insurance_age', 'google', 'google'], googleCalendarIds: [' a ', 'a'] })
    assert.deepEqual(r, { ok: true, patch: { sources: ['google', 'insurance_age'], googleCalendarIds: ['a'] } })
    assert.deepEqual(validateScheduleViewPrefsPatch({ googleCalendarIds: null }), { ok: true, patch: { googleCalendarIds: null } })
  })
  it('저장 JSON 의 모르는 키/손상 값은 버림', () => {
    assert.deepEqual(sanitizeStoredScheduleViewPrefs({ x: 1, includeOverdue: true, sources: ['bad'] }), { includeOverdue: true })
  })
})
