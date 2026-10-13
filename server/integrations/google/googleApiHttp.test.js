import test from 'node:test'
import assert from 'node:assert/strict'
import { googleGetJson } from './googleApiHttp.js'

const res = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body })
const code = async (fetchImpl) => {
  try { await googleGetJson(fetchImpl, new URL('https://example.test/'), 't'); return 'ok' } catch (e) { return e.code }
}

test('429 → google_rate_limited (재연결 권하지 않음)', async () => {
  assert.equal(await code(res(429, {})), 'google_rate_limited')
})
test('403 rateLimitExceeded/quotaExceeded → google_rate_limited', async () => {
  assert.equal(await code(res(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } })), 'google_rate_limited')
  assert.equal(await code(res(403, { error: { errors: [{ reason: 'quotaExceeded' }] } })), 'google_rate_limited')
  assert.equal(await code(res(403, { error: { status: 'RESOURCE_EXHAUSTED' } })), 'google_rate_limited')
})
test('403 기타 → google_forbidden, 401 → google_unauthorized, 5xx/네트워크 → google_unavailable', async () => {
  assert.equal(await code(res(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } })), 'google_forbidden')
  assert.equal(await code(res(403, 'not json')), 'google_forbidden')
  assert.equal(await code(res(401, {})), 'google_unauthorized')
  assert.equal(await code(res(503, {})), 'google_unavailable')
  assert.equal(await code(async () => { throw new Error('net') }), 'google_unavailable')
  assert.equal(await code(res(200, { a: 1 })), 'ok')
})

test('403 accessNotConfigured/SERVICE_DISABLED → google_api_disabled', async () => {
  assert.equal(await code(res(403, { error: { errors: [{ reason: 'accessNotConfigured' }] } })), 'google_api_disabled')
  assert.equal(await code(res(403, { error: { status: 'SERVICE_DISABLED' } })), 'google_api_disabled')
})
