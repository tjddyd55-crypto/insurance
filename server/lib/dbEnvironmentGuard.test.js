import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyDbTarget,
  isDevelopmentDbTarget,
  isProductionDbTarget,
  maskDbHost,
  parseConnectionMeta,
} from './dbEnvironmentGuard.js'

test('maskDbHost: logs without full host in typical cases', () => {
  assert.equal(maskDbHost('shortline.proxy.rlwy.net'), 'shor***.net')
  assert.equal(maskDbHost('tramway.proxy.rlwy.net'), 'tram***.net')
})

test('classifyDbTarget: production public proxy', () => {
  const url = 'postgresql://postgres:secret@shortline.proxy.rlwy.net:17109/railway'
  assert.equal(classifyDbTarget(url, {}), 'railway-production-public-proxy')
  assert.equal(isProductionDbTarget(url, {}), true)
})

test('classifyDbTarget: development public proxy', () => {
  const url = 'postgresql://postgres:secret@tramway.proxy.rlwy.net:44319/railway'
  assert.equal(classifyDbTarget(url, {}), 'railway-development-public-proxy')
  assert.equal(isDevelopmentDbTarget(url, {}), true)
  assert.equal(isProductionDbTarget(url, {}), false)
})

test('classifyDbTarget: INSURANCE_DB_ENVIRONMENT override', () => {
  const url = 'postgresql://postgres:secret@shortline.proxy.rlwy.net:17109/railway'
  assert.equal(classifyDbTarget(url, { INSURANCE_DB_ENVIRONMENT: 'development' }), 'development')
  assert.equal(isProductionDbTarget(url, { INSURANCE_DB_ENVIRONMENT: 'development' }), false)
})

test('classifyDbTarget: railway internal by RAILWAY_ENVIRONMENT', () => {
  const url = 'postgresql://postgres:secret@postgres.railway.internal:5432/railway'
  assert.equal(classifyDbTarget(url, { RAILWAY_ENVIRONMENT: 'production' }), 'railway-production-internal')
  assert.equal(classifyDbTarget(url, { RAILWAY_ENVIRONMENT: 'development' }), 'railway-development-internal')
})

test('parseConnectionMeta: no password in returned object', () => {
  const meta = parseConnectionMeta('postgresql://postgres:secret@shortline.proxy.rlwy.net:17109/railway')
  assert.equal(meta.hostMasked, 'shor***.net')
  assert.equal(meta.dbName, 'railway')
  assert.equal(JSON.stringify(meta).includes('secret'), false)
})
