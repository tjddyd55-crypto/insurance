import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSignupWelcomeSmsMessage } from '../signup/signupWelcomeSms.js'

test('signup welcome SMS: default path when no app_settings value', () => {
  const configured = null
  const message = configured ?? buildSignupWelcomeSmsMessage({ ONEFC_SUPPORT_PHONE: '01012345678' })
  assert.match(message, /ONE FC 가입을 환영합니다/)
  assert.match(message, /010-1234-5678/)
})

test('signup welcome SMS: custom overrides default', () => {
  const configured = '테스트 가입 안내 문자'
  const message = configured ?? buildSignupWelcomeSmsMessage()
  assert.equal(message, '테스트 가입 안내 문자')
})
