import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import express from 'express'
import { registerHealthwayApi } from './registerHealthwayApi.js'
import { ensureHealthwaySchema } from './schema.js'
import { tokenHash } from './crypto.js'
// Adapter-contract fixtures for OUR tests only. No official SDK/sample JSON is copied here.
const fixtureAdapter = {
  async sdk(id, args) {
    if (id === '0003') return { data: [{ termsNo: 'TEST', termsVersionNo: 'TEST', agreementSystemDivisionCode: '10' }] }
    if (id === '0220') return { data: [] }
    if (id === '0005') return { data: [{ provisionDivisionCode: '20', datasetList: [{ datasetCode: '2002', agreementSystemDivisionCode: '31' }] }] }
    if (id === '0187') return { data: [{ provideInstitutionNo: 'TEST-INSTITUTION', provideInstitutionName: 'TEST', publicProvideInstitutionDatasetList: [{ datasetCode: '2001' }, { datasetCode: '2002' }] }] }
    if (id === '0201') return { data: { match: true, mymdResult: '200', utilizationUserNo: 'TEST-NO', connectingInformation: 'TEST-CI', userName: 'TEST-PII', introPath: '22', demandDealingsNo: 'TEST-SAMPLE-DEALINGS' } }
    if (id === '0002') return { data: { access_token: 'TEST-USER-TOKEN', validity_date_time: '2030-01-01T00:00:00' } }
    if (id === '0012') return { data: 'SUCCESS' }
    if (id === '0199') return { data: { accessToken: 'TEST-ACCESS-TOKEN', refreshToken: 'TEST-REFRESH-TOKEN', txId: 'TEST-TX', transmissionDemandId: 'TEST-DEMAND', accessTokenExpireDateTime: '2030-01-01T00:00:00', refreshTokenExpireDateTime: '2030-02-01T00:00:00' } }
    if (id === '0206') return { records: [] }
    if (id === '0207') return { records: [{ id: 'test-visit', contractVersion: 1, source: 'NHIS_PUBLIC', datasetCode: '2002', kind: 'visit', date: '2024-01-15', institution: { name: 'TEST FACILITY' }, visitType: 'institutional', treatmentDays: 7, rawResource: { fixture: 'OUR traceability test only' } }] }
    if (id === '0203' || id === '0008' || id === '0051') return { data: 'SUCCESS' }
    throw new Error(`TEST unsupported method ${id}, ${args?.length}`)
  },
  async certification(input) { return { apiUrl: input.mockAuthPath, mock: true } },
  async signature() { return { mock: true, caCode: 'TEST', signClientId: 'TEST', contentId: 'TEST', signedContent: 'TEST', txId: 'TEST', siteTxId: 'TEST' } },
}
const dbUrl = process.env.HEALTHWAY_TEST_DATABASE_URL
// This suite owns an isolated schema and never reads server/.env or the app DB URL.
test('healthway HTTP + PostgreSQL lifecycle/security', { skip: !dbUrl }, async (t) => {
  const schema = `hw_test_${randomBytes(8).toString('hex')}`
  const admin = new pg.Pool({ connectionString: dbUrl }); await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString: dbUrl, options: `-c search_path=${schema}` })
  let server
  try {
    await pool.query(`CREATE TABLE users(id TEXT PRIMARY KEY,ga_id BIGINT); CREATE TABLE tenants(id BIGINT PRIMARY KEY,legacy_ga_id BIGINT);
      CREATE TABLE customers(id BIGINT PRIMARY KEY,user_id TEXT,name TEXT); INSERT INTO users VALUES('fc-a',1),('fc-b',1),('fc-c',2);
      INSERT INTO tenants VALUES(11,1),(22,2); INSERT INTO customers VALUES(1,'fc-a','TEST-CUSTOMER-PII'),(2,'fc-b','OTHER'),(3,'fc-c','OTHER-GA')`)
    const prior = process.env.HEALTHWAY_MODULE_ENABLED; process.env.HEALTHWAY_MODULE_ENABLED = 'true'
    try { await ensureHealthwaySchema(pool); await ensureHealthwaySchema(pool) }
    finally { if (prior == null) delete process.env.HEALTHWAY_MODULE_ENABLED; else process.env.HEALTHWAY_MODULE_ENABLED = prior }
    const config = { enabled: true, provider: 'offline', offline: true, asOf: '2024-08-07', adapterUrl: 'http://localhost:8080', sharedSecret: randomBytes(32).toString('hex'), tokenKey: randomBytes(32).toString('base64') }
    const app = express(), router = express.Router()
    const requireAuth = (req, res, next) => {
      const id = req.headers.authorization?.replace('Bearer ', '')
      if (!['fc-a', 'fc-b', 'fc-c'].includes(id)) return res.status(401).json({ code: 'unauthorized' })
      req.user = { id, role: 'USER', gaId: id === 'fc-c' ? 2 : 1, customerTenantDbId: id === 'fc-c' ? 22 : 11 }; next()
    }
    registerHealthwayApi(router, { pool, requireAuth, config, adapter: fixtureAdapter })
    registerHealthwayApi(app, { pool, requireAuth, config: { enabled: false } })
    app.use('/api', router)
    server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.on('listening', resolve))
    const root = `http://127.0.0.1:${server.address().port}`
    async function call(path, body, owner = 'fc-a') {
      const r = await fetch(`${root}/api/healthway${path}`, { headers: { Authorization: `Bearer ${owner}`, 'Content-Type': 'application/json' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) })
      return { status: r.status, data: await r.json() }
    }
    const create = async () => {
      const r = await call('/customers/1/requests', { sources: ['NHIS'], medical: false }); assert.equal(r.status, 201); return r.data
    }
    const open = (r) => call(`/public/${r.linkPath.split('/').at(-1)}`)
    const start = (r) => call(`/public/${r.linkPath.split('/').at(-1)}/start`, { terms: true, institutions: ['NHIS'], isJoinPhr: false, isJoinPortal: false })
    const finish = (r, binding) => call(`/public/${r.linkPath.split('/').at(-1)}/mock-auth`, binding)
    await t.test('module routes 404 when disabled, authentication required', async () => {
      assert.equal((await fetch(`${root}/healthway/availability`)).status, 404)
      assert.equal((await call('/customers/1/requests', null, '')).status, 401)
    })
    await t.test('IDOR: other FC / other GA / other customer all denied', async () => {
      assert.equal((await call('/customers/1/requests', null, 'fc-b')).status, 403)
      assert.equal((await call('/customers/1/requests', null, 'fc-c')).status, 403)
      assert.equal((await call('/customers/2/records')).status, 403)
      assert.equal((await call('/customers/999/analysis')).status, 403)
    })
    const request = await create(), token = request.linkPath.split('/').at(-1)
    await t.test('DB stores SHA-256 token only; public flow masks name', async () => {
      const row = (await pool.query('SELECT * FROM healthway_requests WHERE id=$1', [request.request.id])).rows[0]
      assert.equal(row.token_hash, tokenHash(token)); assert.ok(!JSON.stringify(row).includes(token))
      const publicInfo = await open(request); assert.equal(publicInfo.status, 200); assert.ok(!JSON.stringify(publicInfo.data).includes('TEST-CUSTOMER-PII'))
    })
    await t.test('request id inaccessible from different customer / FC', async () => {
      assert.equal((await call(`/customers/1/requests/${request.request.id}`, null, 'fc-b')).status, 403)
      assert.equal((await call(`/customers/2/requests/${request.request.id}`, null, 'fc-b')).status, 404)
    })
    await t.test('wrong token, expired, revoked, cancelled links fail closed', async () => {
      assert.equal((await call(`/public/${randomBytes(32).toString('base64url')}`)).status, 404)
      for (const field of ['expires_at', 'revoked_at']) {
        const r = await create(); await pool.query(`UPDATE healthway_requests SET ${field}=$2 WHERE id=$1`, [r.request.id, field === 'expires_at' ? new Date(0) : new Date()])
        assert.equal((await open(r)).status, 410)
      }
      const r = await create(); await call(`/customers/1/requests/${r.request.id}/cancel`, {}); assert.equal((await open(r)).status, 410)
    })
    await t.test('SMS dry-run validates link binding and never sends', async () => {
      assert.equal((await call(`/customers/1/requests/${request.request.id}/sms-preview`, { linkPath: '/health-connect/wrong' })).status, 403)
      const r = await call(`/customers/1/requests/${request.request.id}/sms-preview`, { linkPath: request.linkPath }); assert.equal(r.data.sent, false)
    })
    const binding = await start(request)
    await t.test('institution consent required; generated mock auth URL stays local', async () => {
      const r = await create(); await open(r)
      const bad = await call(`/public/${r.linkPath.split('/').at(-1)}/start`, { terms: true, institutions: [], isJoinPhr: false, isJoinPortal: false })
      assert.equal(bad.status, 400); assert.equal(binding.status, 200); assert.equal(binding.data.mockAuthPath, `${request.linkPath}/mock-auth`)
    })
    await t.test('callback binding mismatch rejected without consuming legitimate callback', async () => {
      assert.equal((await finish(request, { ...binding.data, nonce: 'wrong' })).status, 403)
      assert.equal((await finish(request, { ...binding.data, demandDealingsNo: 'wrong' })).status, 403)
    })
    await t.test('full mock completion stores encrypted credentials/raw and all evidence', async () => {
      const r = await finish(request, binding.data); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'completed')
      const c = (await pool.query('SELECT * FROM healthway_connections')).rows[0]; assert.ok(!c.credentials_encrypted.includes('TEST-CI'))
      const raw = (await pool.query('SELECT * FROM healthway_records')).rows[0]; assert.ok(!raw.raw_encrypted.includes('traceability'))
      const records = await call('/customers/1/records'); assert.equal(records.data.records.length, 1); assert.equal(records.data.records[0].rawResource, undefined)
      const analysis = await call('/customers/1/analysis'); assert.ok(analysis.data.results.some((r) => r.status === 'INSUFFICIENT_DATA')); assert.equal(analysis.data.evidence[0].id, records.data.records[0].id)
    })
    await t.test('single completion / callback replay / repeated start rejected', async () => {
      assert.equal((await finish(request, binding.data)).status, 409); assert.equal((await start(request)).status, 409)
    })
    await t.test('revocation clears sensitive records/tokens and makes completed link unusable', async () => {
      assert.equal((await call('/customers/1/revoke', {})).status, 200)
      assert.equal((await open(request)).status, 410); assert.equal((await call('/customers/1/records')).data.records.length, 0)
      assert.equal((await pool.query('SELECT COUNT(*) FROM healthway_connections')).rows[0].count, '0')
    })
    await t.test('concurrent callbacks complete once', async () => {
      const r = await create(); await open(r); const b = await start(r)
      const outcomes = await Promise.all([finish(r, b.data), finish(r, b.data)])
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409])
    })
    await t.test('cancellation during SDK retrieval cannot restore a connection snapshot', async () => {
      const r = await create(); await open(r); const b = await start(r)
      const original = fixtureAdapter.sdk
      let release, entered
      const gate = new Promise((resolve) => { release = resolve }), started = new Promise((resolve) => { entered = resolve })
      fixtureAdapter.sdk = async (id, args) => { if (id === '0201') { entered(); await gate } return original(id, args) }
      try {
        const pending = finish(r, b.data); await started
        assert.equal((await call(`/customers/1/requests/${r.request.id}/cancel`, {})).status, 200)
        release(); assert.equal((await pending).status, 409)
        assert.equal((await call(`/customers/1/requests/${r.request.id}`)).data.request.status, 'cancelled')
      } finally { release(); fixtureAdapter.sdk = original }
    })
    await t.test('start rotation invalidates old binding and enforces DB attempt cap', async () => {
      const r = await create(); await open(r)
      const first = await start(r); assert.equal(first.status, 200)
      assert.equal((await start(r)).status, 200)
      assert.equal((await finish(r, first.data)).status, 403)
      assert.equal((await start(r)).status, 200); assert.equal((await start(r)).status, 409)
    })
    await t.test('rate limit returns 429 for repeated bearer-link access', async () => {
      let last
      for (let i = 0; i < 91; i++) last = await call(`/public/${randomBytes(32).toString('base64url')}`)
      assert.equal(last.status, 429)
    })
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end()
  }
})
