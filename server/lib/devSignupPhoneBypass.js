/**
 * develop/test/local 가입 테스트용 휴대폰·SMS 완화.
 * prod(NODE_ENV=production)에서는 env 플래그와 무관하게 항상 비활성.
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isDevSignupPhoneBypassEnabled(env = process.env) {
  if (String(env.NODE_ENV ?? '') === 'production') {
    return false
  }
  return String(env.ALLOW_DEV_SIGNUP_PHONE_BYPASS ?? '').trim().toLowerCase() === 'true'
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldBypassSmsProofForSignup(env = process.env) {
  return isDevSignupPhoneBypassEnabled(env)
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldSkipSignupPhoneDuplicateCheck(env = process.env) {
  return isDevSignupPhoneBypassEnabled(env)
}

/**
 * dev bypass 시 DB 저장용 phone을 시드(username 등) 기준으로 유니크하게 만든다.
 * 입력 번호와 다를 수 있으며, 앱 표시는 users.phone_number 그대로다.
 *
 * @param {string} phoneDigits — normalizeKrMobile 결과
 * @param {string} uniqueSeed — username 또는 user id
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveDevSignupPhoneForStorage(phoneDigits, uniqueSeed, env = process.env) {
  const digits = String(phoneDigits ?? '').replace(/\D/g, '')
  if (!digits) {
    return ''
  }
  if (!isDevSignupPhoneBypassEnabled(env)) {
    return digits
  }

  const seed = String(uniqueSeed ?? '').trim()
  let hash = 5381
  for (const ch of `${digits}:${seed}`) {
    hash = (hash * 33 + ch.charCodeAt(0)) >>> 0
  }
  const tail = String(hash % 100000000).padStart(8, '0')
  return `010${tail}`
}
