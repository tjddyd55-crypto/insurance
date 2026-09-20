/**
 * 출시 초기 무료 운영 — 서버 SSOT.
 *
 * 신규 가입 자동 이용기간 부여는 기본 OFF.
 * 운영자가 명시적으로 `SIGNUP_AUTO_PROMOTION_ENABLED=true` 와
 * `SIGNUP_AUTO_PROMOTION_CODE` 를 함께 설정한 경우에만 허용한다.
 */

function readExplicitOpsFlag(name) {
  return String(process.env[name] ?? '').trim().toLowerCase() === 'true'
}

export function isSignupAutoPromotionEnabled() {
  return (
    readExplicitOpsFlag('SIGNUP_AUTO_PROMOTION_ENABLED')
    && String(process.env.SIGNUP_AUTO_PROMOTION_CODE ?? '').trim().length > 0
  )
}

/** billing enforcement 전역 bypass — `FREE_LAUNCH_GRANT_MODE=true` 일 때만 */
export function isFreeLaunchGrantMode() {
  return readExplicitOpsFlag('FREE_LAUNCH_GRANT_MODE')
}

export function getSignupAutoPromotionCode() {
  return String(process.env.SIGNUP_AUTO_PROMOTION_CODE ?? '').trim()
}
