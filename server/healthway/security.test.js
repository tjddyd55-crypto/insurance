import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, createHmac } from 'node:crypto'
import { checkLink, checkCallback } from './repository.js'
import { healthwayConfig, assertConfigured } from './config.js'
import { encrypt, decrypt, tokenHash, newToken } from './crypto.js'
import { signAdapterRequest, createAdapterClient } from './adapterClient.js'
import { healthwaySmsPreview } from './smsAdapter.js'
import { certificationCase } from './flow.js'
const row = () => ({ status: 'auth_pending', expires_at: new Date(Date.now() + 10000), binding_nonce_hash: tokenHash('test-nonce'), demand_dealings_no: 'test-dealings' })
test('module disabled by default and mock production fails closed', () => {
  assert.equal(healthwayConfig({}).enabled, false)
  for (const env of [{ NODE_ENV: 'production' }, { RAILWAY_ENVIRONMENT_NAME: 'production' }, { HEALTHWAY_PROVIDER: 'testbed' }]) {
    assert.throws(() => assertConfigured(healthwayConfig({ HEALTHWAY_MODULE_ENABLED: 'true', ...env })), /provider_not_configured/)
  }
})
test('link expired/reused/revoked/unknown fails', () => {
  for (const r of [null, { ...row(), expires_at: new Date(0) }, { ...row(), status: 'completed' }, { ...row(), revoked_at: new Date() }, { ...row(), cancelled_at: new Date() }]) assert.throws(() => checkLink(r))
})
test('callback nonce/dealings binding and replay', () => {
  assert.doesNotThrow(() => checkCallback(row(), 'test-nonce', 'test-dealings'))
  for (const [nonce, dealings] of [['wrong', 'test-dealings'], ['test-nonce', 'wrong']]) assert.throws(() => checkCallback(row(), nonce, dealings), /binding_mismatch/)
  assert.throws(() => checkCallback({ ...row(), callback_used_at: new Date() }, 'test-nonce', 'test-dealings'), /already_used/)
})
test('256-bit random links, only hash fits storage', () => {
  const token = newToken(); assert.equal(Buffer.from(token, 'base64url').length, 32); assert.equal(tokenHash(token).length, 64)
})
test('AES-GCM dedicated key and scope AAD prevents cross-customer decryption/tampering', () => {
  const key = randomBytes(32).toString('base64'), data = { token: 'TEST-TOKEN', ci: 'TEST-CI' }, cipher = encrypt(data, key, 'scope-a')
  assert.deepEqual(decrypt(cipher, key, 'scope-a'), data); assert.ok(!cipher.includes('TEST-TOKEN'))
  assert.throws(() => decrypt(cipher, key, 'scope-b')); assert.throws(() => encrypt(data, 'short', 'scope-a'))
})
test('HMAC canonical body/hash and timeout/sanitized adapter failure, no logs', async () => {
  const secret = randomBytes(32).toString('hex'), body = '{"test":true}'
  const headers = signAdapterRequest(secret, '/sdk/0005', body, { timestamp: '1000', nonce: 'TEST_NONCE_000001' })
  assert.equal(headers['X-Healthway-Signature'], createHmac('sha256', secret).update(`POST\n/sdk/0005\n1000\nTEST_NONCE_000001\n${tokenHash(body)}`).digest('hex'))
  const logs = [], original = console.error; console.error = (...args) => logs.push(args)
  try {
    const client = createAdapterClient({ adapterUrl: 'http://localhost:8080', sharedSecret: secret, provider: 'offline' }, async (_url, options) => {
      assert.equal(options.redirect, 'error'); assert.ok(options.signal); throw new Error('TEST-PII TEST-TOKEN')
    })
    await assert.rejects(client.sdk('0005'), /adapter_unavailable/); assert.equal(logs.length, 0)
  } finally { console.error = original }
})
test('offline client rejects non-mock response', async () => {
  const client = createAdapterClient({ adapterUrl: 'http://localhost:8080', sharedSecret: 'TEST', provider: 'offline' }, async () => ({ ok: true, json: async () => ({ mock: false }) }))
  await assert.rejects(client.sdk('0005'), /adapter_unavailable/)
})
test('SMS preview never sends even if existing real gate enabled', () => {
  const prior = process.env.SMS_MODULE_REAL_SEND_ENABLED; process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
  try { const p = healthwaySmsPreview('/health-connect/TEST'); assert.equal(p.sent, false); assert.equal(p.dryRun, true); assert.equal(p.existingRealSendGate, true) }
  finally { if (prior == null) delete process.env.SMS_MODULE_REAL_SEND_ENABLED; else process.env.SMS_MODULE_REAL_SEND_ENABLED = prior }
})
test('0201 official cases 1–4 supported without inventing success', () => {
  assert.equal(certificationCase({ match: true, mymdResult: '200' }), 'CASE1')
  assert.equal(certificationCase({ match: true, mymdResult: '500' }), 'CASE2')
  assert.equal(certificationCase({ match: true, joinUtilizationService: true }), 'CASE3')
  assert.equal(certificationCase({ match: false }), 'CASE4')
})
