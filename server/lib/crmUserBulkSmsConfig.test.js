import assert from 'node:assert/strict'
import test from 'node:test'
import { isProductionRuntime } from './crmUserBulkSmsConfig.js'

test('isProductionRuntime treats Railway development as non-production', () => {
  assert.equal(
    isProductionRuntime({
      NODE_ENV: 'production',
      RAILWAY_ENVIRONMENT: 'development',
    }),
    false,
  )
})

test('isProductionRuntime treats Railway production as production', () => {
  assert.equal(
    isProductionRuntime({
      NODE_ENV: 'production',
      RAILWAY_ENVIRONMENT: 'production',
    }),
    true,
  )
})

test('isProductionRuntime does not treat any non-empty Railway env as production', () => {
  assert.equal(
    isProductionRuntime({
      NODE_ENV: 'production',
      RAILWAY_ENVIRONMENT: 'staging',
    }),
    false,
  )
})
