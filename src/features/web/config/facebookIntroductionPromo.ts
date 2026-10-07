/**
 * Facebook 광고 랜딩(`/introduction/facebook`) 프로모션 코드 SSOT.
 * 변경: `VITE_PUBLIC_FACEBOOK_PROMO_CODE` 또는 이 파일의 DEFAULT만 수정.
 */
const DEFAULT_PUBLIC_FACEBOOK_PROMO_CODE = 'CJAGG46X'

function readEnvPromoCode(): string {
  const raw = import.meta.env.VITE_PUBLIC_FACEBOOK_PROMO_CODE
  if (typeof raw !== 'string') {
    return ''
  }
  return raw.trim()
}

/** 화면 표시·클립보드 복사에 동일하게 사용한다. */
export function getPublicFacebookPromoCode(): string {
  const fromEnv = readEnvPromoCode()
  if (fromEnv) {
    return fromEnv
  }
  return DEFAULT_PUBLIC_FACEBOOK_PROMO_CODE
}

export const FACEBOOK_INTRO_PROMO_COPY_SUCCESS = '프로모션 코드가 복사되었습니다.'
export const FACEBOOK_INTRO_PROMO_COPY_FAILED = '프로모션 코드를 복사하지 못했습니다.'
