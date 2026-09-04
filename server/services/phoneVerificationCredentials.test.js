import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluatePhoneVerificationCredentials,
  isAuthSmsGatewayCredentialReady,
} from './phoneVerificationCredentials.js'

const BASE_ALIGO_ENV = {
  AUTH_SMS_PROVIDER: 'aligo',
  ALIGO_API_KEY: 'test-key',
  ALIGO_USER_ID: 'test-user',
  ALIGO_SENDER: '01012345678',
  ALIGO_TEST_MODE: 'N',
  SIGNUP_PHONE_VERIFICATION_REQUIRED: 'true',
}

const BASE_CRM_GATEWAY_ENV = {
  AUTH_SMS_PROVIDER: 'gateway',
  SMS_MODULE_GATEWAY_URL: 'http://gateway.example/api/crm-sms',
  SMS_MODULE_GATEWAY_TOKEN: 'crm-token',
  ALIGO_API_KEY: 'test-key',
  ALIGO_USER_ID: 'test-user',
  ALIGO_SENDER: '01012345678',
}

const LEGACY_GATEWAY_ENV = {
  AUTH_SMS_PROVIDER: 'gateway',
  SMS_HTTP_GATEWAY_URL: 'https://sms-gateway.example/send-sms',
}

test('evaluatePhoneVerificationCredentials: aligo direct complete → ready', () => {
  const result = evaluatePhoneVerificationCredentials({ ...BASE_ALIGO_ENV })
  assert.equal(result.status, 'ready')
  assert.equal(result.reason, null)
  assert.equal(result.diagnostics.provider, 'aligo')
  assert.equal(result.diagnostics.dbConfigExists, true)
  assert.equal(result.diagnostics.hasApiKeyResolved, true)
  assert.equal(result.diagnostics.gatewayRequired, false)
  assert.equal(result.diagnostics.gatewayConfigured, false)
})

test('evaluatePhoneVerificationCredentials: aligo mode missing apiKey → incomplete', () => {
  const env = { ...BASE_ALIGO_ENV, ALIGO_API_KEY: '' }
  const result = evaluatePhoneVerificationCredentials(env)
  assert.equal(result.status, 'incomplete')
  assert.equal(result.reason, 'aligo_credentials_missing')
  assert.equal(result.diagnostics.hasApiKeyResolved, false)
  assert.equal(result.diagnostics.decryptSuccess, false)
})

test('evaluatePhoneVerificationCredentials: aligo mode missing sender → incomplete', () => {
  const env = { ...BASE_ALIGO_ENV, ALIGO_SENDER: '' }
  const result = evaluatePhoneVerificationCredentials(env)
  assert.equal(result.status, 'incomplete')
  assert.equal(result.reason, 'aligo_credentials_missing')
  assert.equal(result.diagnostics.hasSender, false)
})

test('evaluatePhoneVerificationCredentials: aligo mode missing userId → incomplete', () => {
  const env = { ...BASE_ALIGO_ENV, ALIGO_USER_ID: '' }
  const result = evaluatePhoneVerificationCredentials(env)
  assert.equal(result.status, 'incomplete')
  assert.equal(result.reason, 'aligo_credentials_missing')
  assert.equal(result.diagnostics.hasUserId, false)
})

test('evaluatePhoneVerificationCredentials: gateway mode requires gateway credentials', () => {
  const ready = evaluatePhoneVerificationCredentials({ ...BASE_CRM_GATEWAY_ENV })
  assert.equal(ready.status, 'ready')
  assert.equal(ready.diagnostics.gatewayRequired, true)
  assert.equal(ready.diagnostics.gatewayConfigured, true)

  const incomplete = evaluatePhoneVerificationCredentials({
    ...BASE_CRM_GATEWAY_ENV,
    SMS_MODULE_GATEWAY_TOKEN: '',
  })
  assert.equal(incomplete.status, 'incomplete')
  assert.equal(incomplete.reason, 'gateway_credentials_missing')
})

test('evaluatePhoneVerificationCredentials: aligo mode ignores gateway env presence', () => {
  const result = evaluatePhoneVerificationCredentials({
    ...BASE_ALIGO_ENV,
    SMS_MODULE_GATEWAY_URL: 'http://gateway.example/api/crm-sms',
    SMS_HTTP_GATEWAY_URL: 'https://legacy.example/send-sms',
  })
  assert.equal(result.status, 'ready')
  assert.equal(result.diagnostics.provider, 'aligo')
  assert.equal(result.diagnostics.gatewayRequired, false)
  assert.equal(result.diagnostics.gatewayConfigured, false)
})

test('isAuthSmsGatewayCredentialReady: legacy gateway only needs URL', () => {
  assert.equal(isAuthSmsGatewayCredentialReady({ ...LEGACY_GATEWAY_ENV }), true)
  assert.equal(
    isAuthSmsGatewayCredentialReady({ ...LEGACY_GATEWAY_ENV, SMS_HTTP_GATEWAY_URL: '' }),
    false,
  )
})

test('evaluatePhoneVerificationCredentials: signup/password reset flags', () => {
  const enabled = evaluatePhoneVerificationCredentials({ ...BASE_ALIGO_ENV })
  assert.equal(enabled.diagnostics.signupEnabled, true)
  assert.equal(enabled.diagnostics.passwordResetEnabled, true)

  const signupOff = evaluatePhoneVerificationCredentials({
    ...BASE_ALIGO_ENV,
    SIGNUP_PHONE_VERIFICATION_REQUIRED: 'false',
  })
  assert.equal(signupOff.diagnostics.signupEnabled, false)
})
