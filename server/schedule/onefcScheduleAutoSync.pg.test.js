/**
 * ONE FC 일정 → Google 최소 자동 사본 통합 테스트(실 Postgres + 가짜 Google).
 * ONEFC_TEST_PG_URL(빈 로컬 DB, initDb 적용) 이 없으면 건너뛴다. 운영/DEV DB 에 쓰지 않는다.
 */
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const PG_URL = process.env.ONEFC_TEST_PG_URL
const skip = !PG_URL || /railway|rlwy|amazonaws|supabase/i.test(PG_URL)

describe('ONE FC 일정 Google 자동 사본(통합)', { skip }, () => {
  let pool, server, base, auto, store
  const USER = 'qa214-autosync-user'
  let gaId
  const google = { events: new Map(), mode: 'ok', calls: [] }

  function fakeFetch(input, init = {}) {
    const url = new URL(String(input))
    const method = String(init.method ?? 'GET').toUpperCase()
    google.calls.push(`${method} ${url.pathname}`)
    const json = (status, body) => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
    if (url.hostname !== 'www.googleapis.com') return json(500, { error: 'unexpected host' })
    if (google.mode === 'error') return json(500, { error: { message: 'boom' } })
    if (google.mode === 'unauthorized') return json(401, { error: { message: 'expired' } })
    const m = url.pathname.match(/\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/)
    if (!m) return json(404, {})
    const id = m[2] ? decodeURIComponent(m[2]) : null
    const body = init.body ? JSON.parse(String(init.body)) : null
    if (method === 'POST') {
      if (google.events.has(body.id)) return json(409, { error: { message: 'dup' } })
      google.events.set(body.id, { ...body, status: 'confirmed' })
      return json(200, google.events.get(body.id))
    }
    const ev = id ? google.events.get(id) : null
    if (method === 'GET') return ev ? json(200, ev) : json(404, { error: { message: 'nf' } })
    if (method === 'PUT') { if (!ev) return json(404, {}); google.events.set(id, { ...body, id }); return json(200, google.events.get(id)) }
    if (method === 'PATCH') { if (!ev) return json(404, {}); google.events.set(id, { ...ev, ...body }); return json(200, google.events.get(id)) }
    if (method === 'DELETE') {
      if (google.mode === 'delete404') { google.events.delete(id); return json(404, {}) }
      if (!ev) return json(404, {})
      google.events.delete(id); return Promise.resolve(new Response(null, { status: 204 }))
    }
    return json(400, {})
  }

  async function settle(max = 100) {
    await new Promise((r) => setTimeout(r, 450))
    for (let i = 0; i < max && auto.isAutoSyncRunning(USER); i += 1) await new Promise((r) => setTimeout(r, 50))
  }
  async function api(method, path, body) {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  const maps = async () => (await pool.query(`SELECT source_key, status, google_event_id FROM google_calendar_sync_map WHERE user_id = $1 ORDER BY id`, [USER])).rows
  const gEvents = () => [...google.events.values()]
  const tomorrow = () => { const d = new Date(Date.now() + 9 * 3600e3 + 86400e3); return d.toISOString().slice(0, 10) }
  const plus = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10)

  before(async () => {
    process.env.GOOGLE_CALENDAR_AUTOSYNC_ENABLED = 'true'
    process.env.GOOGLE_WRITE_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = 'b'.repeat(64)
    globalThis.fetch = ((real) => (input, init) => (String(input).startsWith('http://127.0.0.1') ? real(input, init) : fakeFetch(input, init)))(globalThis.fetch)
    const pg = (await import('pg')).default
    pool = new pg.Pool({ connectionString: PG_URL })
    auto = await import('../integrations/google/googleCalendarAutoSync.js')
    store = await import('../integrations/integrationStore.js')
    const { registerOnefcScheduleApi } = await import('../apis/registerOnefcScheduleApi.js')
    const ga = await pool.query(`INSERT INTO ga_companies (name, code) VALUES ('QA-214 GA', 'qa214-' || floor(random()*1e9)::text) RETURNING id`)
    gaId = ga.rows[0].id
    await pool.query(`INSERT INTO users (id, username, password_hash, ga_id, invited_by_user_id) VALUES ($1, $2, 'x', $3, $4) ON CONFLICT DO NOTHING`, [USER, USER, gaId, USER])
    const express = (await import('express')).default
    const app = express(); app.use(express.json())
    const router = express.Router()
    const requireAuth = (req, _res, next) => { req.user = { id: USER, gaId }; next() }
    registerOnefcScheduleApi(router, { pool, requireAuth, handleDbError: (res, e) => { console.error(e); res.status(500).json({ code: 'db' }) } })
    app.use('/api', router)
    await new Promise((r) => { server = app.listen(0, '127.0.0.1', r) })
    base = `http://127.0.0.1:${server.address().port}/api`
  })
  after(async () => {
    await pool?.query(`DELETE FROM google_calendar_sync_map WHERE user_id = $1`, [USER])
    await pool?.query(`DELETE FROM google_calendar_autosync_settings WHERE user_id = $1`, [USER])
    await pool?.query(`DELETE FROM calendar_items WHERE owner_id = $1`, [USER])
    await pool?.query(`DELETE FROM service_integrations WHERE user_id = $1`, [USER])
    await pool?.end(); server?.close()
  })

  it('Google 미연결: ONE FC 저장 201, Google 호출 없음', async () => {
    google.calls = []
    const r = await api('POST', '/schedules', { title: 'QA-214-nogoogle', date: tomorrow(), endDate: tomorrow(), allDay: true, requestId: 'a2140000000000000000000000000001' })
    assert.equal(r.status, 201)
    await settle()
    assert.equal(google.calls.length, 0)
    assert.equal((await maps()).length, 0)
    await api('DELETE', `/schedules/${r.body.data.event.sourceId}`)
    await settle()
  })

  it('연결: 생성(종일·시간)·중복 방지·수정·종일 전환·삭제', async () => {
    await store.saveUserOAuthCredential(pool, {
      userId: USER, providerKey: 'google', accountEmail: 'qa@example.com',
      credential: { accessToken: 'fake-at', accessTokenExpiresAt: Date.now() + 3600e3, refreshToken: 'fake-rt', scope: 'https://www.googleapis.com/auth/calendar.events', sub: 'acct-qa214' },
    })
    await pool.query(`INSERT INTO google_calendar_autosync_settings (user_id, ga_id, enabled, generation) VALUES ($1, $2, TRUE, 1)`, [USER, gaId])
    const d = tomorrow()
    const allDay = await api('POST', '/schedules', { title: 'QA-214-allday', description: '메모', date: d, endDate: plus(d, 1), allDay: true, requestId: 'a2140000000000000000000000000002' })
    assert.equal(allDay.status, 201)
    const again = await api('POST', '/schedules', { title: 'QA-214-allday', description: '메모', date: d, endDate: plus(d, 1), allDay: true, requestId: 'a2140000000000000000000000000002' })
    assert.equal(again.status, 200, 'same requestId → 200, no new row')
    assert.equal(again.body.data.event.sourceId, allDay.body.data.event.sourceId)
    const timed = await api('POST', '/schedules', { title: 'QA-214-timed', date: d, endDate: d, allDay: false, startTime: '09:00', endTime: '10:00', requestId: 'a2140000000000000000000000000003' })
    assert.equal(timed.status, 201)
    await settle()
    let ev = gEvents()
    assert.equal(ev.length, 2, 'exactly 2 Google events (no duplicates)')
    const ga = ev.find((e) => e.summary === 'QA-214-allday')
    assert.deepEqual(ga.start, { date: d }); assert.deepEqual(ga.end, { date: plus(d, 2) }, 'all-day end exclusive')
    assert.equal(ga.description, '메모')
    const gt = ev.find((e) => e.summary === 'QA-214-timed')
    assert.equal(gt.start.dateTime, `${d}T09:00:00+09:00`); assert.equal(gt.end.dateTime, `${d}T10:00:00+09:00`)
    assert.equal(gt.extendedProperties.private.app, 'onefcAutoSync')
    assert.equal((await maps()).filter((m) => m.status === 'active').length, 2)
    const count = (await pool.query(`SELECT count(*)::int AS n FROM calendar_items WHERE owner_id = $1 AND deleted_at IS NULL`, [USER])).rows[0].n
    assert.equal(count, 2)

    // 수정: 제목 + 시간
    const tid = timed.body.data.event.sourceId
    const up = await api('PATCH', `/schedules/${tid}`, { title: 'QA-214-timed-edit', date: d, endDate: d, allDay: false, startTime: '13:00', endTime: '14:30' })
    assert.equal(up.status, 200)
    await settle()
    ev = gEvents()
    assert.equal(ev.length, 2)
    const ge = ev.find((e) => e.id === gt.id)
    assert.equal(ge.summary, 'QA-214-timed-edit'); assert.equal(ge.start.dateTime, `${d}T13:00:00+09:00`); assert.equal(ge.end.dateTime, `${d}T14:30:00+09:00`)
    // 시간 → 종일 전환
    const toAll = await api('PATCH', `/schedules/${tid}`, { title: 'QA-214-timed-edit', date: d, endDate: d, allDay: true })
    assert.equal(toAll.status, 200)
    await settle()
    const ga2 = google.events.get(gt.id)
    assert.deepEqual(ga2.start, { date: d }); assert.deepEqual(ga2.end, { date: plus(d, 1) }); assert.equal(ga2.start.dateTime, undefined)

    // 삭제(정상) + 삭제(Google 404)
    const del = await api('DELETE', `/schedules/${tid}`)
    assert.equal(del.status, 200)
    await settle()
    assert.equal(google.events.has(gt.id), false)
    google.mode = 'delete404'
    const del2 = await api('DELETE', `/schedules/${allDay.body.data.event.sourceId}`)
    assert.equal(del2.status, 200)
    await settle()
    google.mode = 'ok'
    assert.equal(gEvents().length, 0)
    assert.deepEqual((await maps()).map((m) => m.status), ['deleted', 'deleted'])
  })

  it('Google 오류·토큰 만료여도 ONE FC 저장/삭제는 성공(500 아님), 실패는 기록', { timeout: 180000 }, async () => {
    google.mode = 'error'
    const d = tomorrow()
    const r = await api('POST', '/schedules', { title: 'QA-214-gerr', date: d, endDate: d, allDay: true, requestId: 'a2140000000000000000000000000004' })
    assert.equal(r.status, 201)
    await settle(1600)
    const m = (await maps()).find((x) => x.source_key === `schedule:${r.body.data.event.sourceId}`)
    assert.equal(m.status, 'failed')
    const s = (await pool.query(`SELECT last_sync_error FROM google_calendar_autosync_settings WHERE user_id = $1`, [USER])).rows[0]
    assert.equal(s.last_sync_error, 'partial')
    google.mode = 'unauthorized'
    const up = await api('PATCH', `/schedules/${r.body.data.event.sourceId}`, { title: 'QA-214-gerr2', date: d, endDate: d, allDay: true })
    assert.equal(up.status, 200)
    const del = await api('DELETE', `/schedules/${r.body.data.event.sourceId}`)
    assert.equal(del.status, 200)
    await settle(1600)
    const left = (await pool.query(`SELECT count(*)::int AS n FROM calendar_items WHERE owner_id = $1 AND deleted_at IS NULL`, [USER])).rows[0].n
    assert.equal(left, 0)
    google.mode = 'ok'
    // 복구 후 재시도: 남은 삭제 대기 정리
    await auto.requestAutoSync(pool, USER)
  })
})
