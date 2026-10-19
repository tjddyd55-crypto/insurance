import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADVISOR_CONSULTATION_LEAD_STATUSES,
  parseAdvisorConsultationLeadStatus,
  patchAdvisorConsultationLeadForOwner,
} from './advisorConsultationLeadService.js'
import { registerAdvisorConsultationLeadsApi } from './registerAdvisorConsultationLeadsApi.js'

const LEAD = '35133a0b-1e0c-4e24-aef0-501373a8618e'
const OWNER = '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87'

function fakePool(rows = [{ id: LEAD, advisor_user_id: OWNER, status: 'checked' }]) {
  const calls = []
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values })
      return { rowCount: rows.length, rows }
    },
  }
}

function harness(pool) {
  const routes = {}
  const router = {
    get: (path, _auth, handler) => { routes[`GET ${path}`] = handler },
    patch: (path, _auth, handler) => { routes[`PATCH ${path}`] = handler },
  }
  const dbErrors = []
  registerAdvisorConsultationLeadsApi(router, {
    pool,
    requireAuth: () => {},
    handleDbError: (error, req, res) => {
      dbErrors.push({ error, req })
      res.status(500).json({ success: false, message: 'DB_ERROR' })
    },
  })
  const call = async (key, { id, body } = {}) => {
    const out = { status: 200, body: undefined, ended: false }
    const res = {
      status(code) { out.status = code; return this },
      json(payload) { out.body = payload; out.ended = true; return this },
    }
    await routes[key]({ user: { id: OWNER }, params: { id }, body }, res)
    return out
  }
  return { call, dbErrors }
}

test('status SSOT is new|checked|completed and parsing is strict (no fallback to new)', () => {
  assert.deepEqual(ADVISOR_CONSULTATION_LEAD_STATUSES, ['new', 'checked', 'completed'])
  for (const s of ADVISOR_CONSULTATION_LEAD_STATUSES) assert.equal(parseAdvisorConsultationLeadStatus(s), s)
  for (const bad of ['garbage', 'deleted', 'NEW', 'Checked', ' new', '', 1, true, {}, [], null, undefined]) {
    assert.equal(parseAdvisorConsultationLeadStatus(bad), null, `rejects ${JSON.stringify(bad)}`)
  }
})

test('patch: valid statuses update; garbage/NEW are invalid_status with NO DB update; missing/null keep empty_patch', async () => {
  for (const status of ['new', 'checked', 'completed']) {
    const pool = fakePool([{ id: LEAD, advisor_user_id: OWNER, status }])
    const r = await patchAdvisorConsultationLeadForOwner(pool, OWNER, LEAD, { status })
    assert.equal(r.ok, true)
    assert.equal(pool.calls.length, 1)
    assert.match(pool.calls[0].text, /UPDATE advisor_consultation_leads/)
    assert.equal(pool.calls[0].values[0], status)
  }
  for (const status of ['garbage', 'deleted', 'NEW', 42]) {
    const pool = fakePool()
    assert.deepEqual(await patchAdvisorConsultationLeadForOwner(pool, OWNER, LEAD, { status }), { ok: false, code: 'invalid_status' })
    assert.equal(pool.calls.length, 0, 'no DB write for invalid status')
  }
  for (const status of [undefined, null]) {
    const pool = fakePool()
    assert.deepEqual(await patchAdvisorConsultationLeadForOwner(pool, OWNER, LEAD, { status }), { ok: false, code: 'empty_patch' })
    assert.equal(pool.calls.length, 0)
  }
})

test('routes: malformed id 400 without DB; invalid status 400; missing 404; DB error uses handleDbError(e, req, res)', async () => {
  const pool = fakePool()
  const { call } = harness(pool)
  for (const key of ['GET /me/advisor-consultation-leads/:id', 'PATCH /me/advisor-consultation-leads/:id']) {
    const r = await call(key, { id: 'not-a-uuid', body: { status: 'checked' } })
    assert.equal(r.status, 400)
    assert.equal(r.ended, true)
  }
  assert.equal(pool.calls.length, 0)

  const bad = await call('PATCH /me/advisor-consultation-leads/:id', { id: LEAD, body: { status: 'garbage' } })
  assert.equal(bad.status, 400)
  assert.equal(bad.body.message, '상담 신청 상태가 올바르지 않습니다.')
  assert.equal(pool.calls.length, 0)

  const empty = await call('PATCH /me/advisor-consultation-leads/:id', { id: LEAD, body: { status: null } })
  assert.equal(empty.status, 400)
  assert.equal(empty.body.message, '변경할 내용이 없습니다.')

  const ok = await call('PATCH /me/advisor-consultation-leads/:id', { id: LEAD, body: { status: 'checked' } })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.item.status, 'checked')

  const missing = harness(fakePool([]))
  assert.equal((await missing.call('GET /me/advisor-consultation-leads/:id', { id: LEAD })).status, 404)
  assert.equal((await missing.call('PATCH /me/advisor-consultation-leads/:id', { id: LEAD, body: { status: 'checked' } })).status, 404)

  const failing = { async query() { throw Object.assign(new Error('db down'), { code: '57P01' }) } }
  const broken = harness(failing)
  for (const key of ['GET /me/advisor-consultation-leads', 'GET /me/advisor-consultation-leads/:id', 'PATCH /me/advisor-consultation-leads/:id']) {
    const r = await broken.call(key, { id: LEAD, body: { status: 'checked' } })
    assert.equal(r.status, 500)
    assert.equal(r.ended, true, `${key} always responds`)
  }
  assert.equal(broken.dbErrors.length, 3)
  assert.ok(broken.dbErrors.every((e) => e.error instanceof Error && e.req), 'handleDbError(error, req, res) argument order')
})
