import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateAligoDispatchAcceptance,
  evaluateGatewayDispatchAcceptance,
  isAuthSmsProviderAccepted,
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
