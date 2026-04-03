import insuranceCompanyCategoryAliases from '@insurance-shared/insuranceCompanyCategoryAliases.json'

import { buildStaticCompanyCode } from './companyCode'

export const INSURANCE_TYPE_ORDER = ['LIFE', 'NON_LIFE', 'GENERAL'] as const

export type InsuranceCategory = (typeof INSURANCE_TYPE_ORDER)[number]

export const INSURANCE_TYPE_LABELS: Record<InsuranceCategory, string> = {
  LIFE: '생명보험',
  NON_LIFE: '손해보험',
  GENERAL: '일반보험',
}

export const INSURANCE_TYPES = INSURANCE_TYPE_ORDER.map((value) => ({
  label: INSURANCE_TYPE_LABELS[value],
  value,
}))

/** 2차 선택용: 보험사 코드 + 명 + 표준 고객센터(신규 입력 시 고객센터 필드 기본값) */
export interface InsuranceCompanyOption {
  companyCode: string
  name: string
  tel: string
}

function staticCompany(cat: InsuranceCategory, name: string, tel: string): InsuranceCompanyOption {
  return { companyCode: buildStaticCompanyCode(cat, name), name, tel }
}

/** 최종 보험사 데이터(2차 드롭다운). `tel`은 엑셀 기반 대표번호(없으면 빈 문자열). */
export const insuranceCompanyMap: Record<InsuranceCategory, InsuranceCompanyOption[]> = {
  LIFE: [
    staticCompany('LIFE', '교보생명', '15881636'),
    staticCompany('LIFE', '농협생명', '15444422'),
    staticCompany('LIFE', '동양생명', '0808991004'),
    staticCompany('LIFE', '라이나생명', '15442442'),
    staticCompany('LIFE', '메트라이프', '15889609'),
    staticCompany('LIFE', '미래에셋', '15880220'),
    staticCompany('LIFE', '삼성생명', '15883115'),
    staticCompany('LIFE', '신한라이프', '15222285'),
    staticCompany('LIFE', '처브라이프', '15994600'),
    staticCompany('LIFE', '카디프생명', '16881118'),
    staticCompany('LIFE', '하나생명', '15771112'),
    staticCompany('LIFE', '한화생명', '18006633'),
    staticCompany('LIFE', '흥국생명', '18777006'),
    staticCompany('LIFE', 'ABL생명', '15661002'),
    staticCompany('LIFE', 'DB생명', '0264707911'),
    staticCompany('LIFE', 'IBK연금', '0222701661'),
    staticCompany('LIFE', 'iM라이프', '15884770'),
    staticCompany('LIFE', 'KB라이프', '18993899'),
    staticCompany('LIFE', 'KDB생명', '15884040'),
  ],
  NON_LIFE: [
    staticCompany('NON_LIFE', '농협손보', '16449600'),
    staticCompany('NON_LIFE', '라이나손보', ''),
    staticCompany('NON_LIFE', '롯데손보', ''),
    staticCompany('NON_LIFE', '메리츠', '15777711'),
    staticCompany('NON_LIFE', '메리츠화재', '15777711'),
    staticCompany('NON_LIFE', '삼성화재', '15660553'),
    staticCompany('NON_LIFE', '하나손보', '16604590'),
    staticCompany('NON_LIFE', '한화손보', '16701882'),
    staticCompany('NON_LIFE', '현대해상', '15773223'),
    staticCompany('NON_LIFE', '흥국화재', '16886997'),
    staticCompany('NON_LIFE', 'DB손보', '15660757'),
    staticCompany('NON_LIFE', 'KB손보', '15440019'),
    staticCompany('NON_LIFE', 'MG손보', '15773777'),
  ],
  GENERAL: [
    staticCompany('GENERAL', '삼성화재 일반', ''),
    staticCompany('GENERAL', '현대해상 일반', ''),
    staticCompany('GENERAL', 'DB손보 일반', ''),
    staticCompany('GENERAL', 'KB손보 일반', ''),
  ],
}

/** 드롭다운 표시용 보험사 이름 목록 (insuranceCompanyMap과 동기화) */
export const INSURANCE_COMPANIES_BY_TYPE: Record<InsuranceCategory, string[]> = {
  LIFE: insuranceCompanyMap.LIFE.map((c) => c.name),
  NON_LIFE: insuranceCompanyMap.NON_LIFE.map((c) => c.name),
  GENERAL: insuranceCompanyMap.GENERAL.map((c) => c.name),
}

/**
 * 보험사명 별칭 → 구분. 서버는 동일 JSON을 로드(`INSURANCE_COMPANY_CATEGORY_ALIASES`). 수정 시 `shared/insuranceCompanyCategoryAliases.json`만 변경.
 */
export const INSURANCE_COMPANY_NAME_CATEGORY_OVERRIDES = insuranceCompanyCategoryAliases as Record<
  string,
  InsuranceCategory
>

export function isInsuranceCategory(value: string): value is InsuranceCategory {
  return (INSURANCE_TYPE_ORDER as readonly string[]).includes(value)
}

/** 맵에 있는 표준 고객센터 번호(없으면 빈 문자열 → 직접 입력 유도) */
export function getInsuranceCompanyDefaultTel(category: string, companyName: string): string {
  const cat = String(category ?? '').trim()
  if (!cat || !isInsuranceCategory(cat)) {
    return ''
  }
  if (!companyName || typeof companyName !== 'string') {
    return ''
  }
  const q = companyName.trim()
  if (!q) {
    return ''
  }
  const list = insuranceCompanyMap[cat] || []
  const found = list.find((c) => c.name === q)
  return found?.tel ? String(found.tel).trim() : ''
}
