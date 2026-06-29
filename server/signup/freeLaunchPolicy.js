/**
 * 출시 초기 무료 운영 — 서버 SSOT.
 * SIGNUP_AUTO_PROMOTION_CODE 가 설정되면 system grant 모드로 동작한다.
 */

export function isFreeLaunchGrantMode() {
  return String(process.env.SIGNUP_AUTO_PROMOTION_CODE ?? '').trim().length > 0
}

export function getSignupAutoPromotionCode() {
  return String(process.env.SIGNUP_AUTO_PROMOTION_CODE ?? '').trim()
}
