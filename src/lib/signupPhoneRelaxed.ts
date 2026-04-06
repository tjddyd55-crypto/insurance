/**
 * 서버 `INSURANCE_SIGNUP_PHONE_RELAXED` 와 동일 스위치 (배포 시 둘 다 0/false/off).
 * 미설정이면 완화 모드(테스트). 운영: VITE_INSURANCE_SIGNUP_PHONE_RELAXED=0
 */
export function isSignupPhoneRelaxedMode(): boolean {
  const v = String(import.meta.env.VITE_INSURANCE_SIGNUP_PHONE_RELAXED ?? '').toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}
