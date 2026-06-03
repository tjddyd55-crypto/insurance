/** 회원가입 아이디 — server/lib/signupUsername.js 와 동일 정책 */
export const SIGNUP_USERNAME_MIN_LENGTH = 3
export const SIGNUP_USERNAME_MAX_LENGTH = 30

export const SIGNUP_USERNAME_RULE_MESSAGE = '아이디는 영문, 숫자, ., _, - 만 사용할 수 있습니다.'

export const USERNAME_ALLOWED_PATTERN = /^[A-Za-z0-9._-]+$/

export function isValidSignupUsername(raw: string): boolean {
  const trimmed = raw.trim()
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

/** submit/중복 확인 전 검증. null 이면 통과 */
export function getSignupUsernameValidationError(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return '아이디를 입력하세요.'
  }
  if (trimmed.length < SIGNUP_USERNAME_MIN_LENGTH || trimmed.length > SIGNUP_USERNAME_MAX_LENGTH) {
    return '아이디는 3~30자이며 공백을 포함할 수 없습니다.'
  }
  if (/\s/.test(trimmed) || !USERNAME_ALLOWED_PATTERN.test(trimmed)) {
    return SIGNUP_USERNAME_RULE_MESSAGE
  }
  return null
}
