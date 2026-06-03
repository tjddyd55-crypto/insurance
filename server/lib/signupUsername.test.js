import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidSignupUsername,
  SIGNUP_USERNAME_RULE_MESSAGE,
  validateSignupUsername,
} from './signupUsername.js'

test('isValidSignupUsername: 허용 예', () => {
  assert.equal(isValidSignupUsername('test123'), true)
  assert.equal(isValidSignupUsername('test_user'), true)
  assert.equal(isValidSignupUsername('test-user'), true)
  assert.equal(isValidSignupUsername('test.user'), true)
  assert.equal(isValidSignupUsername('park123'), true)
})

test('isValidSignupUsername: 한글·공백 불가', () => {
  assert.equal(isValidSignupUsername('홍길동'), false)
  assert.equal(isValidSignupUsername('test홍길동'), false)
  assert.equal(isValidSignupUsername('테스트123'), false)
  assert.equal(isValidSignupUsername('test user'), false)
})

test('validateSignupUsername: 한글 시 정책 메시지', () => {
  assert.equal(validateSignupUsername('홍길동'), SIGNUP_USERNAME_RULE_MESSAGE)
  assert.equal(validateSignupUsername('test홍길동'), SIGNUP_USERNAME_RULE_MESSAGE)
})

test('validateSignupUsername: 정상 아이디 통과', () => {
  assert.equal(validateSignupUsername('test123'), null)
})
