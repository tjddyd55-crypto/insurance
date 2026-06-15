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
 * 공용 테스트 계정 여부 — GENERAL 코드 또는 공용/GENERAL 계열 GA 이름.
 * role=USER 단독으로는 판정하지 않는다.
 */
export function isPublicGeneralAccount(user: PublicGeneralAccountLike | null | undefined): boolean {
  if (!user) {
    return false
  }
  return isGeneralGaUser(user.gaCode) || isPublicGeneralGaName(user.gaName)
}
