import { shouldBypassSmsProofForSignup } from './devSignupPhoneBypass.js'

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isSignupPhoneVerificationRequired(env = process.env) {
  return String(env.SIGNUP_PHONE_VERIFICATION_REQUIRED ?? 'true').trim().toLowerCase() !== 'false'
}

/**
 * 회원가입 최종 submit 시 SMS proof(JWT) 검증을 생략할지.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldBypassSignupPhoneProofForRegister(env = process.env) {
  if (!isSignupPhoneVerificationRequired(env)) {
    return true
  }
  return shouldBypassSmsProofForSignup(env)
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldRequireSignupPhoneProofForRegister(env = process.env) {
  return !shouldBypassSignupPhoneProofForRegister(env)
}
