/**
 * 테스트 단계 회원가입 완화: 휴대폰 미입력 허용, 번호 중복 검사 생략, 인증 JWT 생략(번호 없을 때).
 *
 * 운영 복구: 환경변수 INSURANCE_SIGNUP_PHONE_RELAXED=0 | false | off
 * (미설정이면 완화 모드 — 테스트 편의. 배포 시 반드시 0/false/off 로 둘 것.)
 */
export function isSignupPhoneRelaxedMode() {
  const v = String(process.env.INSURANCE_SIGNUP_PHONE_RELAXED ?? '').toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}
