import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isServiceAuthSmsPurpose,
  resolveSmsSendPolicy,
  SERVICE_AUTH_SMS_PURPOSES,
} from './smsService.js'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV }
}

test('isServiceAuthSmsPurpose: SIGNUP 및 관련 purpose 인식', () => {
  assert.equal(isServiceAuthSmsPurpose('SIGNUP'), true)
  assert.equal(isServiceAuthSmsPurpose('signup'), true)
  assert.equal(isServiceAuthSmsPurpose('PASSWORD_RESET'), true)
  assert.equal(isServiceAuthSmsPurpose('BULK_MARKETING'), false)
  assert.equal(SERVICE_AUTH_SMS_PURPOSES.has('PHONE_CHANGE'), true)
})

test('resolveSmsSendPolicy: SIGNUP 은 development mock 정책을 우회한다', () => {
  process.env.APP_ENV = 'development'
  delete process.env.RAILWAY_ENVIRONMENT_NAME
  delete process.env.ALLOW_TEST_RECIPIENTS_ONLY
  delete process.env.DISABLE_REAL_SEND

  const policy = resolveSmsSendPolicy('01012345678', 'SIGNUP')
  assert.deepEqual(policy, { kind: 'production' })

  restoreEnv()
})

test('resolveSmsSendPolicy: 단체문자 purpose 는 development 에서 allowlist 없으면 mock', () => {
  process.env.APP_ENV = 'development'
  delete process.env.RAILWAY_ENVIRONMENT_NAME
  delete process.env.ALLOW_TEST_RECIPIENTS_ONLY
  delete process.env.DISABLE_REAL_SEND

  const policy = resolveSmsSendPolicy('01012345678', 'BULK')
  assert.deepEqual(policy, { kind: 'mock', reason: 'allowlist_disabled' })

  restoreEnv()
})

test('resolveSmsSendPolicy: production 은 purpose 무관 production', () => {
  process.env.APP_ENV = 'production'
  delete process.env.RAILWAY_ENVIRONMENT_NAME

  const bulk = resolveSmsSendPolicy('01012345678', 'BULK')
  const signup = resolveSmsSendPolicy('01012345678', 'SIGNUP')
  assert.deepEqual(bulk, { kind: 'production' })
  assert.deepEqual(signup, { kind: 'production' })

  restoreEnv()
})
