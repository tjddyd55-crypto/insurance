import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isDevSignupPhoneBypassEnabled,
  resolveDevSignupPhoneForStorage,
  shouldBypassSmsProofForSignup,
  shouldSkipSignupPhoneDuplicateCheck,
} from './devSignupPhoneBypass.js'

const devBypassEnv = Object.freeze({
  NODE_ENV: 'development',
  ALLOW_DEV_SIGNUP_PHONE_BYPASS: 'true',
})

const prodEnv = Object.freeze({
  NODE_ENV: 'production',
  ALLOW_DEV_SIGNUP_PHONE_BYPASS: 'true',
})

test('production에서는 env true여도 bypass 미적용', () => {
  assert.equal(isDevSignupPhoneBypassEnabled(prodEnv), false)
  assert.equal(shouldBypassSmsProofForSignup(prodEnv), false)
  assert.equal(shouldSkipSignupPhoneDuplicateCheck(prodEnv), false)
})

test('development + ALLOW_DEV_SIGNUP_PHONE_BYPASS=true 일 때만 활성', () => {
  assert.equal(isDevSignupPhoneBypassEnabled(devBypassEnv), true)
  assert.equal(shouldBypassSmsProofForSignup(devBypassEnv), true)
  assert.equal(shouldSkipSignupPhoneDuplicateCheck(devBypassEnv), true)
  assert.equal(
    isDevSignupPhoneBypassEnabled({ NODE_ENV: 'development', ALLOW_DEV_SIGNUP_PHONE_BYPASS: 'false' }),
    false,
  )
})

test('resolveDevSignupPhoneForStorage: bypass 시 username별 유니크 11자리', () => {
  const base = '01000000000'
  const a = resolveDevSignupPhoneForStorage(base, 'testuser1', devBypassEnv)
  const b = resolveDevSignupPhoneForStorage(base, 'testuser2', devBypassEnv)
  const same = resolveDevSignupPhoneForStorage(base, 'testuser1', devBypassEnv)

  assert.match(a, /^010\d{8}$/)
  assert.notEqual(a, b)
  assert.equal(a, same)
})

test('resolveDevSignupPhoneForStorage: bypass 비활성 시 입력 그대로', () => {
  assert.equal(resolveDevSignupPhoneForStorage('01012345678', 'user1', prodEnv), '01012345678')
})
