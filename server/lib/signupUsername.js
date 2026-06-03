/** 회원가입 아이디 — 기존 validateCredentials 길이 정책과 동일 */
export const SIGNUP_USERNAME_MIN_LENGTH = 3
export const SIGNUP_USERNAME_MAX_LENGTH = 30

export const SIGNUP_USERNAME_RULE_MESSAGE = '아이디는 영문, 숫자, ., _, - 만 사용할 수 있습니다.'

/** @type {RegExp} */
export const USERNAME_ALLOWED_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidSignupUsername(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return false
  }
  if (trimmed.length < SIGNUP_USERNAME_MIN_LENGTH || trimmed.length > SIGNUP_USERNAME_MAX_LENGTH) {
    return false
  }
  if (/\s/.test(trimmed)) {
    return false
  }
  return USERNAME_ALLOWED_PATTERN.test(trimmed)
}

/**
 * 신규 가입 username 검증. null 이면 통과.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function validateSignupUsername(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return '아이디를 입력해 주세요.'
  }
  if (trimmed.length < SIGNUP_USERNAME_MIN_LENGTH || trimmed.length > SIGNUP_USERNAME_MAX_LENGTH) {
    return '아이디는 3~30자여야 합니다.'
  }
  if (/\s/.test(trimmed)) {
    return SIGNUP_USERNAME_RULE_MESSAGE
  }
  if (!USERNAME_ALLOWED_PATTERN.test(trimmed)) {
    return SIGNUP_USERNAME_RULE_MESSAGE
  }
  return null
}
