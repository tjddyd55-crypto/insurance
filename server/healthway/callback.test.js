import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHmac, createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import { healthwayConfig, assertConfigured } from './config.js'
import { deriveHealthwayKey, tokenHash } from './crypto.js'
import { signMockCallback, verifyMockCallback } from './mockCallback.js'
import { createCertificationCallback, validateResultData, verifyCallbackResult } from './callback.js'
import { registerHealthwayApi } from './registerHealthwayApi.js'
import { ensureHealthwaySchema } from './schema.js'
import { bypassHealthwayCallback, isHealthwayCallbackPath, safeRequestLogPath } from './requestPrivacy.js'

const config = () => ({ enabled: true, provider: 'offline', offline: true, asOf: '2024-08-07',
  adapterUrl: 'http://127.0.0.1:8080', sharedSecret: randomBytes(32).toString('hex'), tokenKey: randomBytes(32).toString('base64') })
const payload = (caseCode = 'CASE1', demandDealingsNo = randomUUID()) => ({ demandDealingsNo, exp: Math.floor(Date.now() / 1000) + 600, case: caseCode })
const unsafeValues = ['TEST-CALLBACK-NAME', 'TEST-CALLBACK-CI', 'TEST-CALLBACK-USER-NO', 'TEST-CALLBACK-TOKEN', 'TEST-CALLBACK-KEY']
// Our synthetic adapter contract fixture. No SDK samples, keys or official identity data.
function fixtureAdapter() {
  const calls = []
  return { calls,
    async sdk(id) {
      calls.push(id)
      if (id === '0201') return { data: { match: true, mymdResult: '200', utilizationUserNo: unsafeValues[2],
        connectingInformation: unsafeValues[1], userName: unsafeValues[0], introPath: '22', demandDealingsNo: 'STATIC-OFFLINE-SAMPLE' } }
      if (id === '0002') return { data: { access_token: unsafeValues[3], validity_date_time: '2030-01-01T00:00:00' } }
      if (id === '0003' || id === '0220') return { data: [] }
      if (id === '0005') return { data: [{ provisionDivisionCode: '20', datasetList: [{ datasetCode: '2002', agreementSystemDivisionCode: '31' }] }] }
      if (id === '0187') return { data: [{ provideInstitutionNo: 'TEST', provideInstitutionName: 'TEST', publicProvideInstitutionDatasetList: [{ datasetCode: '2001' }, { datasetCode: '2002' }] }] }
      if (id === '0012' || id === '0051') return { data: 'SUCCESS' }
      if (id === '0199') return { data: { accessToken: unsafeValues[3], refreshToken: unsafeValues[3], transmissionDemandId: 'TEST', txId: 'TEST', accessTokenExpireDateTime: '2030-01-01', refreshTokenExpireDateTime: '2030-02-01' } }
      if (id === '0206' || id === '0207') return { records: [] }
      throw new Error(unsafeValues.join(' '))
    },
    async signature() { return { mock: true, caCode: 'TEST', signClientId: 'TEST', contentId: 'TEST', signedContent: 'TEST', txId: 'TEST', siteTxId: 'TEST' } },
  }
}

test('callback accepts only bounded non-control input without assuming an encrypted format', () => {
  for (const value of ['+ /?=&%한글', 'x'.repeat(16384)]) assert.doesNotThrow(() => validateResultData(value))
  for (const value of [null, undefined, '', [], {}, 'x'.repeat(16385), 'x\n', '\x00', '\x7f', '\x85']) assert.throws(() => validateResultData(value), /invalid_input/)
})
test('mock callback domain-separated HMAC, cases and bounded expiry', () => {
  const c = config(), now = 1_800_000_000
  for (const caseCode of ['CASE1', 'CASE2', 'CASE3', 'CASE4']) {
    const p = { demandDealingsNo: 'TEST-DEALINGS', exp: now + 600, case: caseCode }
    const signed = signMockCallback(p, c.tokenKey, now)
    assert.deepEqual(verifyMockCallback(signed, c, now), { demandDealingsNo: p.demandDealingsNo, caseCode })
    assert.throws(() => verifyMockCallback(signed, { ...c, offline: false }, now), /verify_failed/)
    assert.throws(() => verifyMockCallback(signed, c, now + 600), /verify_failed/)
    assert.throws(() => verifyMockCallback(signed, c, now - 61), /verify_failed/)
    assert.throws(() => verifyMockCallback(signed, { ...c, tokenKey: randomBytes(32).toString('hex') }, now), /verify_failed/)
  }
  assert.deepEqual(deriveHealthwayKey(c.tokenKey, 'healthway:mock-callback:v1'), createHmac('sha256', Buffer.from(c.tokenKey, 'base64')).update('healthway:mock-callback:v1').digest())
  const p = { demandDealingsNo: 'TEST', exp: now + 10, case: 'CASE1' }
  for (const extra of [{ nonceHash: 'TEST' }, { exp: now }, { exp: now + 601 }, { case: 'CASE5' }, { demandDealingsNo: '' }]) assert.throws(() => signMockCallback({ ...p, ...extra }, c.tokenKey, now))
  const raw = `MOCKCB.${Buffer.from(JSON.stringify({ ...p, nonceHash: 'TEST' })).toString('base64url')}`
  const signedExtra = `${raw}.${createHmac('sha256', deriveHealthwayKey(c.tokenKey, 'healthway:mock-callback:v1')).update(raw).digest('hex')}`
  assert.throws(() => verifyMockCallback(signedExtra, c, now), /verify_failed/)
})
test('mock callback tolerates forward clock skew without accepting expired or overlong expiry', () => {
  const c = config(), now = 1_800_000_000
  for (const lifetime of [300, 600]) {
    const p = { demandDealingsNo: 'TEST-SKEW', exp: now + 30 + lifetime, case: 'CASE1' }
    const signed = signMockCallback(p, c.tokenKey, now + 30)
    assert.deepEqual(verifyMockCallback(signed, c, now), { demandDealingsNo: p.demandDealingsNo, caseCode: p.case })
  }
  const p = { demandDealingsNo: 'TEST-BOUNDARY', exp: now + 660, case: 'CASE1' }
  const boundary = signMockCallback(p, c.tokenKey, now + 60)
  assert.deepEqual(verifyMockCallback(boundary, c, now), { demandDealingsNo: p.demandDealingsNo, caseCode: p.case })
  const overlong = signMockCallback({ ...p, exp: now + 661 }, c.tokenKey, now + 61)
  assert.throws(() => verifyMockCallback(overlong, c, now), /verify_failed/)
  const expired = signMockCallback({ ...p, exp: now - 1 }, c.tokenKey, now - 301)
  assert.throws(() => verifyMockCallback(expired, c, now), /verify_failed/)
})
test('DEV signer prints only a verifiable relative callback URL; errors never echo inputs', () => {
  const c = config(), demandDealingsNo = randomUUID()
  const before = Math.floor(Date.now() / 1000)
  const signed = spawnSync(process.execPath, ['scripts/healthway/sign-mock-callback.mjs', demandDealingsNo, 'CASE4'], {
    encoding: 'utf8', env: { ...process.env, HEALTHWAY_TOKEN_SECRET_KEY: c.tokenKey },
  })
  assert.equal(signed.status, 0); assert.equal(signed.stderr, '')
  assert.equal(signed.stdout.includes(c.tokenKey), false)
  const url = new URL(signed.stdout.trim(), 'https://example.invalid')
  assert.equal(url.pathname, '/api/healthway/callback/cert')
  const { exp } = JSON.parse(Buffer.from(url.searchParams.get('resultData').split('.')[1], 'base64url').toString('utf8'))
  assert.ok(exp >= before + 300 && exp <= Math.floor(Date.now() / 1000) + 300)
  assert.deepEqual(verifyMockCallback(url.searchParams.get('resultData'), c), { demandDealingsNo, caseCode: 'CASE4' })
  const bad = spawnSync(process.execPath, ['scripts/healthway/sign-mock-callback.mjs', demandDealingsNo, unsafeValues[0]], {
    encoding: 'utf8', env: { ...process.env, HEALTHWAY_TOKEN_SECRET_KEY: unsafeValues[4] },
  })
  assert.equal(bad.status, 1); assert.equal(bad.stdout, '')
  for (const value of [...unsafeValues, demandDealingsNo]) assert.equal(bad.stderr.includes(value), false)
})
test('live verifier requires configuration, rejects mocks, and uses only documented 0201 args', async () => {
  const c = { ...config(), provider: 'testbed', offline: false }, calls = []
  const adapter = { sdk: async (...args) => { calls.push(args); return { data: { match: true, isJoinUtilizationService: false, mymdResult: '200', demandDealingsNo: 'TEST', userName: unsafeValues[0], connectingInformation: unsafeValues[1] } } } }
  assert.equal(healthwayConfig({ HEALTHWAY_DECRYPTION_KEY: unsafeValues[4] }).decryptionKey, unsafeValues[4])
  await assert.rejects(verifyCallbackResult('encrypted-fixture', c, adapter), { status: 503, code: 'provider_not_configured' })
  await assert.rejects(verifyCallbackResult(signMockCallback(payload(), c.tokenKey), { ...c, decryptionKey: unsafeValues[4] }, adapter), { status: 400, code: 'verify_failed' })
  assert.equal(calls.length, 0)
  const verified = await verifyCallbackResult('encrypted-fixture', { ...c, decryptionKey: unsafeValues[4] }, adapter)
  assert.deepEqual(calls, [['0201', ['encrypted-fixture', unsafeValues[4]]]])
  assert.deepEqual(verified, { demandDealingsNo: 'TEST', caseCode: 'CASE1' })
  assert.throws(() => assertConfigured({ ...c, decryptionKey: unsafeValues[4] }), /provider_not_configured/)
  await assert.rejects(verifyCallbackResult('encrypted-fixture', { ...c, decryptionKey: unsafeValues[4] }, { sdk: async () => { throw new Error(unsafeValues.join(' ')) } }), { code: 'verify_failed' })
})
test('callback log paths strip all query values across mounts and preserve unrelated paths', () => {
  for (const prefix of ['/api', '/backend', '/api/api', '/backend/api', '']) {
    const url = `${prefix}/healthway/callback/cert?resultData=TEST&unknown=TEST`
    assert.equal(isHealthwayCallbackPath(url), true)
    assert.equal(safeRequestLogPath({ originalUrl: url }), url.split('?')[0])
  }
  assert.equal(isHealthwayCallbackPath('/api/healthway/callback-other'), false)
  assert.equal(safeRequestLogPath({ originalUrl: '/api/other?q=test' }), '/api/other?q=test')
})

// Exercise the public handler without a DB; fail fast if throttled traffic reaches an adapter.
function limitFixture(t, c = config()) {
  let writes = 0
  const lines = []
  t.mock.method(console, 'log', (line) => lines.push(line))
  const callback = createCertificationCallback({ config: c,
    pool: { query: async () => { writes++; return { rows: [] } } },
    adapter: { sdk: () => assert.fail('limited request reached adapter') },
  })
  return { lines, get writes() { return writes }, async call(ip = '192.0.2.1') {
    const res = { set() { return this }, status(value) { this.statusCode = value; return this },
      type() { return this }, send(body) { this.body = body; return this } }
    await callback({ ip, method: 'GET', url: '/callback/cert', get: () => 'test-agent' }, res)
    return res
  } }
}
test('callback limits request 31, logs only the first excess hit, and resets at 60s', async (t) => {
  let now = 100_000
  t.mock.method(Date, 'now', () => now)
  const f = limitFixture(t)
  for (let i = 0; i < 30; i++) assert.equal((await f.call()).statusCode, 400)
  assert.equal(f.writes, 30)
  const limited = await f.call()
  assert.equal(limited.statusCode, 429); assert.match(limited.body, /처리 불가/)
  assert.match(limited.body, /요청을 처리할 수 없습니다/)
  await Promise.all(Array.from({ length: 40 }, () => f.call()))
  assert.equal(f.writes, 31)
  assert.equal(f.lines.filter((line) => line.includes('outcome=rate_limited')).length, 41)
  assert.match(f.lines.at(-1), /^\[healthway-callback\] outcome=rate_limited case=- len=0 rid=-$/)
  now += 59_999
  assert.equal((await f.call()).statusCode, 429); assert.equal(f.writes, 31)
  assert.equal((await f.call('192.0.2.2')).statusCode, 400)
  now++
  assert.equal((await f.call()).statusCode, 400)
  assert.equal(f.writes, 33)
})
test('callback caps clients at 10000, skips overflow DB logs and prunes expired keys', async (t) => {
  let now = 100_000
  t.mock.method(Date, 'now', () => now)
  const f = limitFixture(t)
  for (let i = 0; i < 10_000; i++) assert.equal((await f.call(`client-${i}`)).statusCode, 400)
  for (let i = 0; i < 10; i++) assert.equal((await f.call(`overflow-${i}`)).statusCode, 429)
  assert.equal(f.writes, 10_000)
  // Existing clients can still use their allowance while the map is full.
  assert.equal((await f.call('client-0')).statusCode, 400)
  now += 60_000
  assert.equal((await f.call('overflow-0')).statusCode, 400)
  assert.equal(f.writes, 10_002)
})
test('callback still rate limits when client log hashing is unavailable', async (t) => {
  const f = limitFixture(t, { ...config(), tokenKey: '' })
  for (let i = 0; i < 30; i++) assert.equal((await f.call()).statusCode, 400)
  assert.equal((await f.call()).statusCode, 429)
  assert.equal((await f.call()).statusCode, 429)
  assert.equal(f.writes, 31)
})

const dbUrl = process.env.HEALTHWAY_TEST_DATABASE_URL
test('callback HTTP + PostgreSQL completion, replay, privacy and fail-closed guards', { skip: !dbUrl }, async (t) => {
  const schema = `hw_callback_${randomBytes(8).toString('hex')}`
  const admin = new pg.Pool({ connectionString: dbUrl })
  await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString: dbUrl, options: `-c search_path=${schema}` }), c = config(), adapter = fixtureAdapter()
  let server
  const consoleLines = [], originalLog = console.log
  console.log = (...args) => consoleLines.push(args.join(' '))
  try {
    const prior = process.env.HEALTHWAY_MODULE_ENABLED
    process.env.HEALTHWAY_MODULE_ENABLED = 'true'
    try { await ensureHealthwaySchema(pool); await ensureHealthwaySchema(pool) }
    finally { if (prior == null) delete process.env.HEALTHWAY_MODULE_ENABLED; else process.env.HEALTHWAY_MODULE_ENABLED = prior }
    const app = express(), api = express.Router()
    const requireAuth = (_req, res) => res.sendStatus(401)
    app.use(bypassHealthwayCallback(cors()))
    app.use(bypassHealthwayCallback(express.json()))
    registerHealthwayApi(api, { pool, adapter, config: c, requireAuth })
    app.use('/api', api)
    const live = express.Router(), noKey = express.Router()
    registerHealthwayApi(live, { pool, adapter, requireAuth, config: { ...c, offline: false, provider: 'testbed', decryptionKey: unsafeValues[4] } })
    registerHealthwayApi(noKey, { pool, adapter, requireAuth, config: { ...c, offline: false, provider: 'testbed' } })
    app.use('/live', live); app.use('/no-key', noKey)
    // Permit the oversized fixture through the HTTP parser so the endpoint's own 16KiB check runs.
    server = createServer({ maxHeaderSize: 32768 }, app).listen(0, '127.0.0.1'); await new Promise((resolve) => server.on('listening', resolve))
    const root = `http://127.0.0.1:${server.address().port}`
    async function pending(caseCode = 'CASE1', extra = {}) {
      const id = randomUUID(), p = payload(caseCode)
      await pool.query(`INSERT INTO healthway_requests(id,owner_user_id,ga_id,customer_id,token_hash,expires_at,status,sources,consents,demand_dealings_no)
        VALUES($1,'test-owner',1,1,$2,$3,$4,'["NHIS"]','{"sensitiveInformation":false}',$5)`,
      [id, tokenHash(randomUUID()), extra.expires_at || new Date(Date.now() + 60_000), extra.status || 'auth_pending', p.demandDealingsNo])
      for (const field of ['callback_used_at', 'cancelled_at', 'revoked_at']) if (extra[field]) await pool.query(`UPDATE healthway_requests SET ${field}=NOW() WHERE id=$1`, [id])
      return { id, resultData: signMockCallback(p, c.tokenKey), p }
    }
    let clientNumber = 0
    async function call(resultData, options = {}) {
      const { mount = '/api', query = '', ...fetchOptions } = options
      const r = await fetch(`${root}${mount}/healthway/callback/cert?${resultData == null ? '' : `resultData=${encodeURIComponent(resultData)}`}${query}`, {
        ...fetchOptions, headers: { 'User-Agent': 'TEST-CALLBACK-UA', 'X-Forwarded-For': `192.0.2.${++clientNumber}`, ...fetchOptions.headers },
      })
      return { status: r.status, body: await r.text(), headers: r.headers }
    }
    const getRow = async (id) => (await pool.query('SELECT * FROM healthway_requests WHERE id=$1', [id])).rows[0]
    let requestCount = 0
    async function checkLogs(fn, expected, errors = 0, resultData) {
      const before = new Set((await pool.query('SELECT id FROM healthway_callback_logs')).rows.map((r) => r.id))
      const lineCount = consoleLines.length, response = await fn()
      requestCount++
      const logs = (await pool.query('SELECT * FROM healthway_callback_logs ORDER BY received_at,id')).rows
      const added = logs.filter((r) => !before.has(r.id))
      assert.equal(added.length, 1 + errors)
      assert.equal(added.filter((r) => r.level === 'access').length, 1)
      assert.equal(added.filter((r) => r.level === 'error').length, errors)
      for (const row of added) {
        assert.equal(row.outcome, expected)
        assert.equal(row.error_code, errors ? expected : null)
      }
      assert.equal(logs.filter((r) => r.level === 'access').length, requestCount)
      assert.equal(consoleLines.length - lineCount, 1)
      assert.match(consoleLines.at(-1), /^\[healthway-callback\] outcome=[a-z_]+ case=(CASE[1-4]|-) len=\d+ rid=([a-f0-9]{8}|-)$/)
      for (const forbidden of [...unsafeValues, c.tokenKey, c.sharedSecret, '127.0.0.1', 'TEST-CALLBACK-UA', ...(resultData ? [resultData] : [])]) {
        // Boolean assertions keep sensitive fixture values out of assertion diagnostics.
        assert.equal(response.body.includes(forbidden), false)
        assert.equal(JSON.stringify(logs).includes(forbidden), false)
        assert.equal(consoleLines.join('\n').includes(forbidden), false)
      }
      return response
    }
    await t.test('valid CASE1 completes existing encrypted offline flow; unknown query ignored', async () => {
      const r = await pending()
      const response = await checkLogs(() => call(r.resultData, { query: '&ignored=anything' }), 'success', 0, r.resultData)
      assert.equal(response.status, 200); assert.match(response.body, /성공/); assert.match(response.body, /연결 완료, 창을 닫고 설계사에게 알려주세요/)
      assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
      assert.equal(response.headers.get('x-frame-options'), 'DENY'); assert.match(response.headers.get('content-security-policy'), /default-src 'none'; style-src 'unsafe-inline'/)
      assert.equal((await getRow(r.id)).status, 'completed')
      assert.ok((await getRow(r.id)).callback_used_at)
      const logs = (await pool.query('SELECT * FROM healthway_callback_logs WHERE request_id=$1', [r.id])).rows
      assert.equal(logs[0].case_code, 'CASE1'); assert.equal(logs[0].result_data_sha256, tokenHash(r.resultData)); assert.equal(logs[0].result_data_length, r.resultData.length)
      assert.match(logs[0].client_ip_hash, /^[a-f0-9]{64}$/); assert.match(logs[0].user_agent_hash, /^[a-f0-9]{64}$/)
      const creds = (await pool.query('SELECT credentials_encrypted FROM healthway_connections')).rows[0].credentials_encrypted
      for (const forbidden of unsafeValues) assert.equal(creds.includes(forbidden), false)
      assert.equal((await checkLogs(() => call(r.resultData), 'replay', 1, r.resultData)).status, 409)
    })
    await t.test('CASE3 reports already joined and completes the existing offline sample flow', async () => {
      const r = await pending('CASE3'), response = await checkLogs(() => call(r.resultData), 'already_joined', 0, r.resultData)
      assert.equal(response.status, 200); assert.match(response.body, /이미 가입/); assert.equal((await getRow(r.id)).status, 'completed')
    })
    await t.test('CASE2/CASE4 retain auth_pending without consuming callback; retry can succeed', async () => {
      for (const caseCode of ['CASE2', 'CASE4']) {
        const r = await pending(caseCode), callsBefore = adapter.calls.length
        const response = await checkLogs(() => call(r.resultData), caseCode === 'CASE2' ? 'retry_join_failed' : 'retry_auth_failed', 1, r.resultData)
        assert.equal(response.status, 200); assert.match(response.body, /재시도 필요/)
        const row = await getRow(r.id); assert.equal(row.status, 'auth_pending'); assert.equal(row.callback_used_at, null); assert.equal(row.attempt_count, 0)
        assert.equal(adapter.calls.length, callsBefore)
        const retry = signMockCallback({ ...r.p, case: 'CASE1' }, c.tokenKey)
        assert.equal((await checkLogs(() => call(retry), 'success', 0, retry)).status, 200)
      }
    })
    await t.test('bad HMAC and expired mock fail verification without SDK calls or consumption', async () => {
      const r = await pending(), callsBefore = adapter.calls.length
      const bad = `${r.resultData.slice(0, -1)}${r.resultData.at(-1) === '0' ? '1' : '0'}`
      const expired = signMockCallback({ ...r.p, exp: Math.floor(Date.now() / 1000) - 1 }, c.tokenKey, Math.floor(Date.now() / 1000) - 20)
      for (const value of [bad, expired, 'not-a-mock']) assert.equal((await checkLogs(() => call(value), 'verify_failed', 1, value)).status, 400)
      assert.equal(adapter.calls.length, callsBefore); assert.equal((await getRow(r.id)).status, 'auth_pending')
    })
    await t.test('missing/empty/oversized/control/duplicate resultData yields 400', async () => {
      for (const value of [null, '', 'x'.repeat(16385), 'x\n', '\u0085']) assert.equal((await checkLogs(() => call(value), 'invalid_input', 1, value)).status, 400)
      const r = await pending()
      assert.equal((await checkLogs(() => call(r.resultData, { query: '&resultData=other' }), 'invalid_input', 1, r.resultData)).status, 400)
    })
    await t.test('unknown, expired, revoked, cancelled and consumed/non-pending requests yield 409', async () => {
      for (const extra of [{ expires_at: new Date(0) }, { revoked_at: true }, { cancelled_at: true }, { callback_used_at: true }, { status: 'created' }, { status: 'failed' }, { status: 'processing' }]) {
        const r = await pending('CASE1', extra)
        assert.equal((await checkLogs(() => call(r.resultData), 'replay', 1, r.resultData)).status, 409)
      }
      const unknown = signMockCallback(payload(), c.tokenKey)
      assert.equal((await checkLogs(() => call(unknown), 'replay', 1, unknown)).status, 409)
    })
    await t.test('concurrent callbacks claim and complete only once', async () => {
      const r = await pending(), before = (await pool.query("SELECT COUNT(*) FROM healthway_callback_logs WHERE level='access'")).rows[0].count
      const results = await Promise.all([call(r.resultData), call(r.resultData)])
      requestCount += 2
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
      const after = (await pool.query("SELECT COUNT(*) FROM healthway_callback_logs WHERE level='access'")).rows[0].count
      assert.equal(Number(after) - Number(before), 2)
    })
    await t.test('HEAD and all other methods including CORS preflight and invalid JSON POST yield 405', async () => {
      for (const method of ['HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
        const response = await checkLogs(() => call(null, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid', 'Access-Control-Request-Method': 'GET' }, ...(method === 'POST' ? { body: '{invalid-json' } : {}) }), 'method_not_allowed', 1)
        assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET')
      }
    })
    await t.test('router retains offline-only guard even when a real key is configured', async () => {
      const callsBefore = adapter.calls.length
      for (const mount of ['/live', '/no-key']) {
        const response = await checkLogs(() => call('encrypted-fixture', { mount }), 'provider_not_configured', 1, 'encrypted-fixture')
        assert.equal(response.status, 503); assert.match(response.body, /처리 불가/)
      }
      assert.equal(adapter.calls.length, callsBefore)
    })
    await t.test('SDK exceptions never escape to generic logger or leak to callback logs/body', async () => {
      const r = await pending(), original = adapter.sdk
      adapter.sdk = async () => { throw Object.assign(new Error(unsafeValues.join(' ')), { code: unsafeValues[0] }) }
      try {
        const response = await checkLogs(() => call(r.resultData), 'internal_error', 1, r.resultData)
        assert.equal(response.status, 500); assert.equal((await getRow(r.id)).status, 'failed')
      } finally { adapter.sdk = original }
    })
    await t.test('forwarded clients have separate buckets without trust proxy and limited hits log only once', async () => {
      const before = Number((await pool.query('SELECT COUNT(*) FROM healthway_callback_logs')).rows[0].count)
      const options = { headers: { 'X-Forwarded-For': '198.51.100.1' } }
      for (let i = 0; i < 30; i++) assert.equal((await call(null, options)).status, 400)
      const limited = await call(null, options)
      assert.equal(limited.status, 429); assert.match(limited.body, /처리 불가/)
      assert.equal(limited.headers.get('cache-control'), 'no-store')
      assert.match(limited.headers.get('content-security-policy'), /default-src 'none'/)
      for (const response of await Promise.all(Array.from({ length: 20 }, () => call(null, options)))) assert.equal(response.status, 429)
      const after = Number((await pool.query('SELECT COUNT(*) FROM healthway_callback_logs')).rows[0].count)
      assert.equal(after - before, 62) // 30 invalid requests + first limited hit: access + error each.
      const otherOptions = { headers: { 'X-Forwarded-For': '198.51.100.2, 10.0.0.1' } }
      for (let i = 0; i < 30; i++) assert.equal((await call(null, otherOptions)).status, 400)
      assert.equal((await call(null, otherOptions)).status, 429)
      assert.equal((await call(null, options)).status, 429)
      const limitedLogs = (await pool.query("SELECT * FROM healthway_callback_logs WHERE outcome='rate_limited'")).rows
      assert.deepEqual(limitedLogs.map((row) => row.level).sort(), ['access', 'access', 'error', 'error'])
      const expectedHashes = ['198.51.100.1', '198.51.100.2'].map((ip) =>
        createHash('sha256').update(deriveHealthwayKey(c.tokenKey, 'healthway:callback-log:ip:v1')).update(ip).digest('hex'))
      assert.deepEqual([...new Set(limitedLogs.map((row) => row.client_ip_hash))].sort(), expectedHashes.sort())
      for (const row of limitedLogs) {
        assert.equal(row.error_code, 'rate_limited')
        assert.match(row.client_ip_hash, /^[a-f0-9]{64}$/)
        assert.equal(JSON.stringify(row).includes('198.51.100.1'), false)
      }
    })
    await t.test('log insert failure preserves callback response and one sanitized console line', async () => {
      await pool.query('ALTER TABLE healthway_callback_logs RENAME TO temporarily_unavailable_logs')
      try {
        const before = consoleLines.length, response = await call(null)
        assert.equal(response.status, 400); assert.equal(consoleLines.length - before, 1)
      } finally { await pool.query('ALTER TABLE temporarily_unavailable_logs RENAME TO healthway_callback_logs') }
    })
  } finally {
    console.log = originalLog
    if (server) await new Promise((resolve) => server.close(resolve))
    await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end()
  }
})
