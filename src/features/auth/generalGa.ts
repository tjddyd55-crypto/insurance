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
