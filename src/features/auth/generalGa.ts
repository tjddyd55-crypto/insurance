/** 시스템 기본 공용 GA 코드(비교용 대문자) */
export const GENERAL_GA_CODE = 'GENERAL'

/**
 * GA 회사 코드 정규화 — 서버 `normalizeGaCompanyCode` 와 동일 규칙.
 */
export function normalizeGaCompanyCode(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/** 공용(GENERAL) 소속 설계사 여부 */
export function isGeneralGaUser(gaCode: string | null | undefined): boolean {
  return normalizeGaCompanyCode(gaCode) === GENERAL_GA_CODE
}

/** GA 표시명이 공용/GENERAL 계열인지 (코드 없이 이름만 공용인 경우 포함) */
export function isPublicGeneralGaName(gaName: string | null | undefined): boolean {
  const trimmed = String(gaName ?? '').trim()
  if (!trimmed) {
    return false
  }
  const upper = trimmed.toUpperCase()
  if (upper === 'GENERAL' || trimmed === '공용') {
    return true
  }
  return trimmed.includes('공용')
}

export type PublicGeneralAccountLike = {
  gaCode?: string | null
  gaName?: string | null
}

/**
 * 공용(GENERAL) 소속 설계사 여부 — GA 미소속 개인 사용자 판별 SSOT.
 * 가입 시 GA 코드 입력 여부가 아니라 현재 세션의 GA 회사(코드·이름)로 판단한다.
 * GA 전용 기능 게이트: `!isPublicGeneralAccount(user)` 이면 정상 이용.
 */
export function isPublicGeneralAccount(user: PublicGeneralAccountLike | null | undefined): boolean {
  if (!user) {
    return false
  }
  return isGeneralGaUser(user.gaCode) || isPublicGeneralGaName(user.gaName)
}
