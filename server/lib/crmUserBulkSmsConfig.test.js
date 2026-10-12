import assert from 'node:assert/strict'
import test from 'node:test'
import { isProductionRuntime, resolveCrmUserBulkSmsDispatchMode } from './crmUserBulkSmsConfig.js'

const DISPATCH_ENV_KEYS = [
  'SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED',
  'SUPER_ADMIN_USER_BULK_SMS_DEV_ALLOWLIST',
  'RAILWAY_ENVIRONMENT',
  'APP_ENV',
]

function snapshotDispatchEnv() {
  return Object.fromEntries(DISPATCH_ENV_KEYS.map((key) => [key, process.env[key]]))
}

function restoreDispatchEnv(snapshot) {
  for (const key of DISPATCH_ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
}

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

test('resolveCrmUserBulkSmsDispatchMode: 실발송 플래그가 없으면 dry-run', () => {
  const snapshot = snapshotDispatchEnv()
  delete process.env.SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED
  process.env.RAILWAY_ENVIRONMENT = 'production'
  try {
    const mode = resolveCrmUserBulkSmsDispatchMode()
    assert.equal(mode.dryRun, true)
    assert.equal(mode.reason, 'real_send_disabled')
  } finally {
    restoreDispatchEnv(snapshot)
  }
})

test('resolveCrmUserBulkSmsDispatchMode: 비운영에서 allowlist가 비면 실발송 플래그와 무관하게 dry-run', () => {
  const snapshot = snapshotDispatchEnv()
  process.env.SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED = 'true'
  process.env.RAILWAY_ENVIRONMENT = 'development'
  delete process.env.SUPER_ADMIN_USER_BULK_SMS_DEV_ALLOWLIST
  try {
    const mode = resolveCrmUserBulkSmsDispatchMode()
    assert.equal(mode.dryRun, true)
    assert.equal(mode.reason, 'dev_allowlist_empty')
    assert.equal(mode.production, false)
  } finally {
    restoreDispatchEnv(snapshot)
  }
})

test('resolveCrmUserBulkSmsDispatchMode: 운영에서 실발송 플래그가 켜지면 dry-run이 아니다', () => {
  const snapshot = snapshotDispatchEnv()
  process.env.SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED = 'true'
  process.env.RAILWAY_ENVIRONMENT = 'production'
  delete process.env.SUPER_ADMIN_USER_BULK_SMS_DEV_ALLOWLIST
  try {
    const mode = resolveCrmUserBulkSmsDispatchMode()
    assert.equal(mode.dryRun, false)
    assert.equal(mode.reason, 'real_send')
    assert.equal(mode.production, true)
  } finally {
    restoreDispatchEnv(snapshot)
  }
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
