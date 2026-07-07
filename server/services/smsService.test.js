import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  buildAuthSmsGatewayHeaders,
  buildAuthSmsGatewayPayload,
  evaluateAligoDispatchAcceptance,
  evaluateGatewayDispatchAcceptance,
  isAuthSmsProviderAccepted,
  isServiceAuthSmsPurpose,
  resolveAuthSmsGatewayEndpoint,
  resolveAuthSmsProvider,
  resolveSmsSendPolicy,
  SERVICE_AUTH_SMS_PURPOSES,
} from './smsService.js'

const BASE_ALIGO_ENV = {
  ALIGO_API_KEY: 'test-key',
  ALIGO_USER_ID: 'test-user',
  ALIGO_SENDER: '01012345678',
}

const BASE_LEGACY_GATEWAY_ENV = {
  SMS_HTTP_GATEWAY_URL: 'https://sms-gateway.example/send-sms',
}

const BASE_CRM_GATEWAY_ENV = {
  SMS_MODULE_GATEWAY_URL: 'http://gateway.example/api/crm-sms',
  SMS_MODULE_GATEWAY_TOKEN: 'crm-token',
  ...BASE_ALIGO_ENV,
}

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

test('resolveSmsSendPolicy: SIGNUP 은 SMS_MODULE_REAL_SEND_ENABLED=false 여도 production', () => {
  process.env.APP_ENV = 'development'
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
  delete process.env.ALLOW_TEST_RECIPIENTS_ONLY

  const policy = resolveSmsSendPolicy('01012345678', 'SIGNUP')
  assert.deepEqual(policy, { kind: 'production' })

  restoreEnv()
})

test('resolveSmsSendPolicy: SIGNUP 은 SMS_MODULE_REAL_SEND_ENABLED=true 여도 production', () => {
  process.env.APP_ENV = 'development'
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
  delete process.env.ALLOW_TEST_RECIPIENTS_ONLY

  const policy = resolveSmsSendPolicy('01012345678', 'SIGNUP')
  assert.deepEqual(policy, { kind: 'production' })

  restoreEnv()
})

test('evaluateAligoDispatchAcceptance: result_code 1 + msg_id + success_cnt 1 → accepted', () => {
  const result = evaluateAligoDispatchAcceptance({
    result_code: 1,
    success_cnt: 1,
    msg_id: '123456789',
  })
  assert.equal(result.accepted, true)
  assert.equal(result.provider, 'aligo')
  assert.equal(result.providerMessageId, '123456789')
  assert.equal(result.resultCode, 1)
  assert.equal(result.successCount, 1)
})

test('evaluateAligoDispatchAcceptance: result_code -101 → rejected', () => {
  const result = evaluateAligoDispatchAcceptance({
    result_code: -101,
    message: 'invalid key',
  })
  assert.equal(result.accepted, false)
  assert.equal(result.provider, 'aligo')
  assert.equal(result.errorCode, -101)
})

test('evaluateAligoDispatchAcceptance: result_code 1인데 msg_id 없음 → rejected', () => {
  const result = evaluateAligoDispatchAcceptance({
    result_code: 1,
    success_cnt: 1,
  })
  assert.equal(result.accepted, false)
  assert.equal(result.provider, 'aligo')
})

test('evaluateGatewayDispatchAcceptance: success true 단독 → rejected', () => {
  const result = evaluateGatewayDispatchAcceptance({ success: true, sent: true })
  assert.equal(result.accepted, false)
  assert.equal(result.provider, 'gateway')
})

test('evaluateGatewayDispatchAcceptance: sent true + providerMessageId → accepted', () => {
  const result = evaluateGatewayDispatchAcceptance({
    sent: true,
    providerMessageId: 'gw-abc-123',
  })
  assert.equal(result.accepted, true)
  assert.equal(result.provider, 'gateway')
  assert.equal(result.providerMessageId, 'gw-abc-123')
})

test('evaluateGatewayDispatchAcceptance: msg_id 필드도 accepted', () => {
  const result = evaluateGatewayDispatchAcceptance({ msg_id: '998877' })
  assert.equal(result.accepted, true)
  assert.equal(result.providerMessageId, '998877')
})

test('isAuthSmsProviderAccepted: providerMessageId 없으면 false', () => {
  assert.equal(
    isAuthSmsProviderAccepted({ success: true, sent: true, provider: 'aligo' }),
    false,
  )
  assert.equal(
    isAuthSmsProviderAccepted({
      success: true,
      sent: true,
      provider: 'aligo',
      providerMessageId: '123',
    }),
    true,
  )
})

test('isAuthSmsProviderAccepted: mock success 는 false', () => {
  assert.equal(
    isAuthSmsProviderAccepted({
      success: true,
      sent: false,
      mocked: true,
    }),
    false,
  )
})

test('evaluateGatewayDispatchAcceptance: Aligo raw success(result_code 1, msg_id, success_cnt 1) → accepted', () => {
  const result = evaluateGatewayDispatchAcceptance({
    result_code: 1,
    success_cnt: 1,
    msg_id: '12345',
    message: 'success',
  })
  assert.equal(result.accepted, true)
  assert.equal(result.provider, 'gateway')
  assert.equal(result.providerMessageId, '12345')
  assert.equal(result.resultCode, 1)
  assert.equal(result.successCount, 1)
})

test('evaluateGatewayDispatchAcceptance: Aligo raw -102 API 인증오류 → rejected', () => {
  const result = evaluateGatewayDispatchAcceptance({
    result_code: -102,
    message: 'API 인증오류입니다.',
    success_cnt: 0,
  })
  assert.equal(result.accepted, false)
  assert.equal(result.provider, 'gateway')
  assert.equal(result.errorCode, -102)
  assert.equal(result.errorMessage, 'API 인증오류입니다.')
})

test('resolveAuthSmsProvider: SIGNUP — CRM gateway 설정 시 gateway 선택', () => {
  const signup = resolveAuthSmsProvider({ ...BASE_CRM_GATEWAY_ENV })
  assert.equal(signup.provider, 'gateway')
  assert.equal(signup.gatewayConfigured, true)

  const passwordReset = resolveAuthSmsProvider({
    ...BASE_CRM_GATEWAY_ENV,
    AUTH_SMS_PROVIDER: 'gateway',
  })
  assert.equal(passwordReset.provider, 'gateway')
})

test('resolveAuthSmsProvider: CRM+legacy 모두 있으면 CRM 기준 gateway configured', () => {
  const result = resolveAuthSmsProvider({
    ...BASE_CRM_GATEWAY_ENV,
    ...BASE_LEGACY_GATEWAY_ENV,
  })
  assert.equal(result.provider, 'gateway')
  const endpoint = resolveAuthSmsGatewayEndpoint({
    ...BASE_CRM_GATEWAY_ENV,
    ...BASE_LEGACY_GATEWAY_ENV,
  })
  assert.equal(endpoint?.mode, 'crm')
  assert.equal(endpoint?.endpointPath, '/send')
})

test('resolveAuthSmsProvider: ALIGO+legacy gateway → gateway', () => {
  const result = resolveAuthSmsProvider({
    ...BASE_ALIGO_ENV,
    ...BASE_LEGACY_GATEWAY_ENV,
  })
  assert.equal(result.provider, 'gateway')
  assert.equal(result.aligoConfigured, true)
  assert.equal(result.gatewayConfigured, true)
})

test('resolveAuthSmsProvider: AUTH_SMS_PROVIDER=aligo → aligo', () => {
  const result = resolveAuthSmsProvider({
    ...BASE_ALIGO_ENV,
    ...BASE_LEGACY_GATEWAY_ENV,
    AUTH_SMS_PROVIDER: 'aligo',
  })
  assert.equal(result.provider, 'aligo')
})

test('resolveAuthSmsProvider: AUTH_SMS_PROVIDER=gateway → gateway', () => {
  const result = resolveAuthSmsProvider({
    ...BASE_ALIGO_ENV,
    ...BASE_LEGACY_GATEWAY_ENV,
    AUTH_SMS_PROVIDER: 'gateway',
  })
  assert.equal(result.provider, 'gateway')
})

test('resolveAuthSmsProvider: legacy gateway만 → gateway', () => {
  const result = resolveAuthSmsProvider({
    ...BASE_LEGACY_GATEWAY_ENV,
  })
  assert.equal(result.provider, 'gateway')
  assert.equal(result.gatewayConfigured, true)
  assert.equal(result.aligoConfigured, false)
})

test('resolveAuthSmsProvider: AUTH_SMS_PROVIDER=gateway but URL 없음 → gateway_unconfigured', () => {
  const result = resolveAuthSmsProvider({
    ...BASE_ALIGO_ENV,
    AUTH_SMS_PROVIDER: 'gateway',
  })
  assert.equal(result.provider, null)
  assert.equal(result.errorCode, 'gateway_unconfigured')
})

test('resolveAuthSmsProvider: invalid AUTH_SMS_PROVIDER → invalid_auth_sms_provider', () => {
  const result = resolveAuthSmsProvider({
    ...BASE_ALIGO_ENV,
    AUTH_SMS_PROVIDER: 'twilio',
  })
  assert.equal(result.provider, null)
  assert.equal(result.errorCode, 'invalid_auth_sms_provider')
})

test('buildAuthSmsGatewayPayload: CRM 모드는 단체문자 contract(receiver, user_id, api_key)', () => {
  const payload = buildAuthSmsGatewayPayload(
    { phone: '01099998888', message: '인증번호는 123456 입니다.', purpose: 'SIGNUP' },
    BASE_CRM_GATEWAY_ENV,
  )
  assert.equal(payload.provider, 'aligo')
  assert.equal(payload.receiver, '01099998888')
  assert.equal(payload.user_id, 'test-user')
  assert.equal(payload.api_key, 'test-key')
  assert.equal(payload.sender, '01012345678')
  assert.equal(payload.message_type, 'SMS')
  assert.equal(payload.testmode_yn, 'N')
  assert.equal(Object.hasOwn(payload, 'phone'), false)
})

test('buildAuthSmsGatewayPayload: legacy 모드는 phone/message/purpose', () => {
  const payload = buildAuthSmsGatewayPayload(
    { phone: '01099998888', message: 'test', purpose: 'PASSWORD_RESET' },
    BASE_LEGACY_GATEWAY_ENV,
  )
  assert.deepEqual(payload, {
    phone: '01099998888',
    message: 'test',
    purpose: 'PASSWORD_RESET',
  })
})

test('buildAuthSmsGatewayHeaders: CRM 모드 Bearer token', () => {
  const headers = buildAuthSmsGatewayHeaders(BASE_CRM_GATEWAY_ENV)
  assert.equal(headers.Authorization, 'Bearer crm-token')
  assert.equal(headers['Content-Type'], 'application/json')
})

test('smsService.js: server/sms/** import 없음', () => {
  const path = fileURLToPath(new URL('./smsService.js', import.meta.url))
  const source = readFileSync(path, 'utf8')
  assert.equal(source.includes("from '../sms/"), false)
  assert.equal(source.includes('SMS_MODULE_REAL_SEND_ENABLED'), false)
})
