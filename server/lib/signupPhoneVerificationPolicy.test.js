import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSignupPhoneVerificationRequired,
  shouldBypassSignupPhoneProofForRegister,
  shouldRequireSignupPhoneProofForRegister,
} from './signupPhoneVerificationPolicy.js'

test('isSignupPhoneVerificationRequired defaults to true', () => {
  assert.equal(isSignupPhoneVerificationRequired({}), true)
  assert.equal(isSignupPhoneVerificationRequired({ SIGNUP_PHONE_VERIFICATION_REQUIRED: 'true' }), true)
  assert.equal(isSignupPhoneVerificationRequired({ SIGNUP_PHONE_VERIFICATION_REQUIRED: 'TRUE' }), true)
})

test('isSignupPhoneVerificationRequired is false only when env is false', () => {
  assert.equal(isSignupPhoneVerificationRequired({ SIGNUP_PHONE_VERIFICATION_REQUIRED: 'false' }), false)
  assert.equal(isSignupPhoneVerificationRequired({ SIGNUP_PHONE_VERIFICATION_REQUIRED: ' FALSE ' }), false)
})

test('shouldBypassSignupPhoneProofForRegister when verification disabled', () => {
  const env = { SIGNUP_PHONE_VERIFICATION_REQUIRED: 'false', NODE_ENV: 'production' }
  assert.equal(shouldBypassSignupPhoneProofForRegister(env), true)
  assert.equal(shouldRequireSignupPhoneProofForRegister(env), false)
})

test('shouldRequireSignupPhoneProofForRegister in production when verification enabled', () => {
  const env = { SIGNUP_PHONE_VERIFICATION_REQUIRED: 'true', NODE_ENV: 'production' }
  assert.equal(shouldBypassSignupPhoneProofForRegister(env), false)
  assert.equal(shouldRequireSignupPhoneProofForRegister(env), true)
})
