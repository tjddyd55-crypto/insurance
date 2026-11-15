// No credentials in source/logs. OFFLINE ONLY: actual app login -> SDK adapter samples -> evidence.
import assert from 'node:assert/strict'
const base = process.env.HEALTHWAY_E2E_BASE_URL, username = process.env.HEALTHWAY_E2E_USERNAME, password = process.env.HEALTHWAY_E2E_PASSWORD
if (!base || !username || !password) throw new Error('HEALTHWAY_E2E_BASE_URL / USERNAME / PASSWORD required')
const api = process.env.HEALTHWAY_E2E_API_PREFIX || '/backend'
const origin = new URL(base)
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw new Error('HTTPS or localhost required')
let passed = 0
async function call(path, body, auth) {
  const response = await fetch(new URL(api + path, base), { headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(90000), redirect: 'error' })
  if (!response.ok) throw new Error(`E2E stage failed (HTTP ${response.status}; details withheld)`)
  return response.json()
}
try {
  const login = await call('/auth/login', { username, password }); assert.ok(login.token); passed++
  const availability = await call('/healthway/availability', null, login.token); assert.equal(availability.provider, 'offline'); assert.equal(availability.mock, true); passed++
  const customers = await call('/customers', null, login.token), rows = Array.isArray(customers) ? customers : customers.data || customers.customers
  const customerId = process.env.HEALTHWAY_E2E_CUSTOMER_ID || rows?.[0]?.id; assert.ok(customerId); passed++
  const route = `/healthway/customers/${customerId}`
  const created = await call(`${route}/requests`, { sources: ['NHIS', 'HIRA'], medical: true }, login.token)
  assert.match(created.linkPath, /^\/health-connect\/[A-Za-z0-9_-]{43}$/); passed++
  // The public SPA page must also be served at its deep URL.
  const page = await fetch(new URL(created.linkPath, base)); assert.equal(page.status, 200); assert.match(page.headers.get('content-type'), /text\/html/); passed++
  const token = created.linkPath.split('/').at(-1), publicPath = `/healthway/public/${token}`
  const info = await call(publicPath); assert.equal(info.mock, true); assert.ok(info.terms.length); assert.ok(info.unityTerms.length); passed++
  const auth = await call(`${publicPath}/start`, { terms: true, institutions: ['NHIS', 'HIRA'], medical: true, sensitiveInformation: true, isJoinPhr: false, isJoinPortal: false })
  assert.equal(auth.mockAuthPath, `${created.linkPath}/mock-auth`); passed++
  const done = await call(`${publicPath}/mock-auth`, { nonce: auth.nonce, demandDealingsNo: auth.demandDealingsNo }); assert.equal(done.status, 'completed'); passed++
  const records = await call(`${route}/records`, null, login.token)
  for (const code of ['2001', '2002', '2004', '1004']) assert.ok(records.records.some((r) => r.datasetCode === code), `Dataset ${code} absent: check offline reference date against sample era`)
  assert.ok(records.coverage.every((c) => c.offlineAsOfDate)); assert.ok(records.records.every((r) => !r.rawResource)); passed++
  const analysis = await call(`${route}/analysis`, null, login.token)
  assert.equal(analysis.results.find((r) => r.ruleCode === 'REPEAT_5Y').status, 'INSUFFICIENT_DATA')
  assert.equal(analysis.results.find((r) => r.ruleCode === 'SURGERY').status, 'UNSUPPORTED'); passed++
  const ids = new Set(analysis.evidence.map((r) => r.id))
  assert.ok(analysis.results.flatMap((r) => r.evidenceIds).every((id) => ids.has(id))); passed++
  const replay = await fetch(new URL(api + publicPath + '/mock-auth', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce: auth.nonce, demandDealingsNo: auth.demandDealingsNo }) })
  assert.equal(replay.status, 409); passed++
  console.log(`OFFLINE E2E passed: ${passed} stages; ${records.records.length} records; ${analysis.results.length} rules. No real lookup/SMS.`)
} catch (error) {
  console.error(`OFFLINE E2E failed after ${passed} stages: ${error instanceof assert.AssertionError ? error.message : 'request failed (sensitive details withheld)'}`)
  process.exitCode = 1
}
