import type { InsuranceCategory } from './insuranceConstants'

/** 미등록(표준 맵) 선택 시 2차 드롭다운 값. 저장 후 서버는 INS + id 코드를 부여. */
export const STATIC_COMPANY_CODE_PREFIX = 'STATIC:'

/**
 * 저장 직후 정규화된 코드 (`INS` + 숫자, 예: INS000123).
 * 시드·GA stub 코드(`INS_SEED_011`, `INS_FHL_12`)는 여기에 포함되지 않는다.
 */
export function isInsCompanyCode(code: string): boolean {
  return /^INS\d+$/.test(String(code ?? '').trim())
}

/**
 * DB `insurance_company_master.company_code` 로 이미 존재하는 선택값인지.
 * STATIC: 신규 직접입력 후보가 아닌 모든 코드(시드·정규 INS·GA stub)를 포함한다.
 */
export function isPersistedDirectoryCompanyCode(code: string): boolean {
  const s = String(code ?? '').trim()
  if (!s) return false
  if (s.startsWith(STATIC_COMPANY_CODE_PREFIX)) return false
  return true
}

export function buildStaticCompanyCode(category: InsuranceCategory, name: string): string {
  return `${STATIC_COMPANY_CODE_PREFIX}${category}:${String(name ?? '').trim().normalize('NFKC')}`
}

export function parseStaticCompanyCode(
  code: string,
): { category: InsuranceCategory; name: string } | null {
  const s = String(code ?? '').trim()
  if (!s.startsWith(STATIC_COMPANY_CODE_PREFIX)) {
    return null
  }
  const rest = s.slice(STATIC_COMPANY_CODE_PREFIX.length)
  const colon = rest.indexOf(':')
  if (colon <= 0) {
    return null
  }
  const cat = rest.slice(0, colon)
  const name = rest.slice(colon + 1).trim()
  if (cat !== 'LIFE' && cat !== 'NON_LIFE' && cat !== 'GENERAL') {
    return null
  }
  return { category: cat as InsuranceCategory, name }
}
