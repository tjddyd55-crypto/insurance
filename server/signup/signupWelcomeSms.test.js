import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SIGNUP_WELCOME_SMS_PURPOSE,
  buildSignupWelcomeSmsMessage,
  formatOnefcSupportPhoneDisplay,
} from './signupWelcomeSms.js'
import { isServiceAuthSmsPurpose, resolveSmsSendPolicy } from '../services/smsService.js'

test('SIGNUP_WELCOME is not treated as service auth SMS', () => {
  assert.equal(SIGNUP_WELCOME_SMS_PURPOSE, 'SIGNUP_WELCOME')
  assert.equal(isServiceAuthSmsPurpose(SIGNUP_WELCOME_SMS_PURPOSE), false)
  assert.equal(isServiceAuthSmsPurpose('SIGNUP'), true)
})

const ORIGINAL_ENV = { ...process.env }

test('resolveSmsSendPolicy: SIGNUP_WELCOME follows dev transactional mock policy', () => {
  process.env.APP_ENV = 'development'
  delete process.env.RAILWAY_ENVIRONMENT_NAME
  delete process.env.ALLOW_TEST_RECIPIENTS_ONLY
  delete process.env.DISABLE_REAL_SEND

  const policy = resolveSmsSendPolicy('01012345678', SIGNUP_WELCOME_SMS_PURPOSE)
  assert.deepEqual(policy, { kind: 'mock', reason: 'allowlist_disabled' })

  process.env = { ...ORIGINAL_ENV }
})

test('buildSignupWelcomeSmsMessage uses ONEFC_SUPPORT_PHONE display format', () => {
  const msg = buildSignupWelcomeSmsMessage({ ONEFC_SUPPORT_PHONE: '01022221382' })
  assert.match(msg, /\[ONE FC\]/)
  assert.match(msg, /ONE FC 가입을 환영합니다/)
  assert.match(msg, /문의: 010-2222-1382/)
  assert.doesNotMatch(msg, /광고|할인|이벤트/)
})

test('formatOnefcSupportPhoneDisplay: missing env falls back to 고객센터', () => {
  assert.equal(formatOnefcSupportPhoneDisplay({}), '고객센터')
})
