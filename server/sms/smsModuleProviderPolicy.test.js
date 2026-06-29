import assert from 'node:assert/strict'
import test from 'node:test'
import { gatewaySmsProvider } from './providers/gatewaySmsProvider.js'
import { resolveSmsProvider } from './smsProviderFactory.js'
import {
  assertSmsModuleProductionProviderPolicy,
  assertSmsRealSendAllowed,
  normalizeSmsModuleProviderMode,
  readSmsModuleRuntimeInfo,
  validateSmsModuleStartupConfig,
} from './smsModuleConfig.js'

const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const GATEWAY_ENV = {
  SMS_MODULE_GATEWAY_URL: 'http://gateway.example/api/crm-sms',
  SMS_MODULE_GATEWAY_TOKEN: 'gateway-token',
  SMS_CREDENTIALS_SECRET_KEY: SECRET,
}

function saveEnv(keys) {
  /** @type {Record<string, string | undefined>} */
  const snapshot = {}
  for (const key of keys) {
    snapshot[key] = process.env[key]
  }
  return snapshot
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function applyProductionBaseEnv(overrides = {}) {
  process.env.NODE_ENV = 'production'
  process.env.RAILWAY_ENVIRONMENT = 'production'
  process.env.SMS_MODULE_ENABLED = 'true'
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
  Object.assign(process.env, GATEWAY_ENV, overrides)
}

const PRODUCTION_ENV_KEYS = [
  'NODE_ENV',
  'RAILWAY_ENVIRONMENT',
  'SMS_MODULE_ENABLED',
  'SMS_MODULE_REAL_SEND_ENABLED',
  'SMS_MODULE_PROVIDER',
  'SMS_MODULE_GATEWAY_URL',
  'SMS_MODULE_GATEWAY_TOKEN',
  'SMS_CREDENTIALS_SECRET_KEY',
]

test('normalizeSmsModuleProviderMode — aligo_gateway는 gateway로 정규화', () => {
  assert.equal(normalizeSmsModuleProviderMode('aligo_gateway'), 'gateway')
  assert.equal(normalizeSmsModuleProviderMode('GATEWAY'), 'gateway')
  assert.equal(normalizeSmsModuleProviderMode('unknown'), '')
})

test('production + SMS_MODULE_PROVIDER=gateway → 허용', () => {
  const snap = saveEnv(PRODUCTION_ENV_KEYS)
  try {
    applyProductionBaseEnv({ SMS_MODULE_PROVIDER: 'gateway' })
    const startup = validateSmsModuleStartupConfig()
    assert.equal(startup.ok, true)
    const runtime = readSmsModuleRuntimeInfo()
    assert.equal(runtime.mode, 'gateway')
    assert.equal(runtime.providerMisconfigured, false)
    assert.doesNotThrow(() => assertSmsModuleProductionProviderPolicy())
  } finally {
    restoreEnv(snap)
  }
})

test('production + SMS_MODULE_PROVIDER=aligo_gateway → 허용', () => {
  const snap = saveEnv(PRODUCTION_ENV_KEYS)
  try {
    applyProductionBaseEnv({ SMS_MODULE_PROVIDER: 'aligo_gateway' })
    const startup = validateSmsModuleStartupConfig()
    assert.equal(startup.ok, true)
    const runtime = readSmsModuleRuntimeInfo()
    assert.equal(runtime.mode, 'gateway')
    assert.equal(runtime.usesGateway, true)
  } finally {
    restoreEnv(snap)
  }
})

test('production + SMS_MODULE_PROVIDER=aligo → 허용', () => {
  const snap = saveEnv(PRODUCTION_ENV_KEYS)
  try {
    applyProductionBaseEnv({ SMS_MODULE_PROVIDER: 'aligo' })
    delete process.env.SMS_MODULE_GATEWAY_URL
    delete process.env.SMS_MODULE_GATEWAY_TOKEN
    const startup = validateSmsModuleStartupConfig()
    assert.equal(startup.ok, true)
    const runtime = readSmsModuleRuntimeInfo()
    assert.equal(runtime.mode, 'aligo')
    assert.equal(runtime.usesGateway, false)
  } finally {
    restoreEnv(snap)
  }
})

test('production + SMS_MODULE_PROVIDER=mock → 차단', () => {
  const snap = saveEnv(PRODUCTION_ENV_KEYS)
  try {
    applyProductionBaseEnv({ SMS_MODULE_PROVIDER: 'mock' })
    const startup = validateSmsModuleStartupConfig()
    assert.equal(startup.ok, false)
    assert.match(startup.message ?? '', /gateway 또는 aligo_gateway 또는 aligo/)
    const runtime = readSmsModuleRuntimeInfo()
    assert.equal(runtime.mode, 'invalid')
    assert.throws(() => assertSmsModuleProductionProviderPolicy(), /sms_production_provider_required/)
  } finally {
    restoreEnv(snap)
  }
})

test('production + SMS_MODULE_PROVIDER 미설정 → 차단', () => {
  const snap = saveEnv(PRODUCTION_ENV_KEYS)
  try {
    applyProductionBaseEnv()
    delete process.env.SMS_MODULE_PROVIDER
    const startup = validateSmsModuleStartupConfig()
    assert.equal(startup.ok, false)
    const runtime = readSmsModuleRuntimeInfo()
    assert.equal(runtime.mode, 'invalid')
  } finally {
    restoreEnv(snap)
  }
})

test('production + gateway provider일 때 runtime은 provider=gateway 표시', () => {
  const snap = saveEnv(PRODUCTION_ENV_KEYS)
  try {
    applyProductionBaseEnv({ SMS_MODULE_PROVIDER: 'gateway' })
    const runtime = readSmsModuleRuntimeInfo()
    assert.equal(runtime.mode, 'gateway')
    assert.equal(runtime.testMode, false)
    assert.equal(runtime.realSendEnabled, false)
  } finally {
    restoreEnv(snap)
  }
})

test('SMS_MODULE_PROVIDER=gateway일 때 smsProviderFactory가 gateway provider 래핑 반환', () => {
  const snap = saveEnv(['SMS_MODULE_PROVIDER', 'NODE_ENV', 'RAILWAY_ENVIRONMENT', ...Object.keys(GATEWAY_ENV)])
  try {
    process.env.NODE_ENV = 'development'
    delete process.env.RAILWAY_ENVIRONMENT
    process.env.SMS_MODULE_PROVIDER = 'gateway'
    Object.assign(process.env, GATEWAY_ENV)
    const provider = resolveSmsProvider()
    assert.notEqual(provider, gatewaySmsProvider)
    assert.equal(typeof provider.send, 'function')
    assert.equal(typeof provider.getBalance, 'function')
  } finally {
    restoreEnv(snap)
  }
})

test('REAL_SEND=false이면 gateway provider policy 통과 후에도 send 차단', async () => {
  const snap = saveEnv(PRODUCTION_ENV_KEYS)
  try {
    applyProductionBaseEnv({ SMS_MODULE_PROVIDER: 'gateway' })
    await assert.rejects(
      async () => {
        assertSmsRealSendAllowed()
      },
      (err) => err.message === 'sms_real_send_disabled',
    )
  } finally {
    restoreEnv(snap)
  }
})
