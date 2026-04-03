import insuranceCompanyCategoryAliases from '@insurance-shared/insuranceCompanyCategoryAliases.json'

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

/** 2차 선택용: 보험사명 + 표준 고객센터(신규 입력 시 고객센터 필드 기본값) */
export interface InsuranceCompanyOption {
  name: string
  tel: string
}

/** 최종 보험사 데이터(2차 드롭다운). `tel`은 엑셀 기반 대표번호(없으면 빈 문자열). */
export const insuranceCompanyMap: Record<InsuranceCategory, InsuranceCompanyOption[]> = {
  LIFE: [
    { name: '교보생명', tel: '15881636' },
    { name: '농협생명', tel: '15444422' },
    { name: '동양생명', tel: '0808991004' },
    { name: '라이나생명', tel: '15442442' },
    { name: '메트라이프', tel: '15889609' },
    { name: '미래에셋', tel: '15880220' },
    { name: '삼성생명', tel: '15883115' },
    { name: '신한라이프', tel: '15222285' },
    { name: '처브라이프', tel: '15994600' },
    { name: '카디프생명', tel: '16881118' },
    { name: '하나생명', tel: '15771112' },
    { name: '한화생명', tel: '18006633' },
    { name: '흥국생명', tel: '18777006' },
    { name: 'ABL생명', tel: '15661002' },
    { name: 'DB생명', tel: '0264707911' },
    { name: 'IBK연금', tel: '0222701661' },
    { name: 'iM라이프', tel: '15884770' },
    { name: 'KB라이프', tel: '18993899' },
    { name: 'KDB생명', tel: '15884040' },
  ],
  NON_LIFE: [
    { name: '농협손보', tel: '16449600' },
    { name: '라이나손보', tel: '' },
    { name: '롯데손보', tel: '' },
    { name: '메리츠', tel: '15777711' },
    { name: '메리츠화재', tel: '15777711' },
    { name: '삼성화재', tel: '15660553' },
    { name: '하나손보', tel: '16604590' },
    { name: '한화손보', tel: '16701882' },
    { name: '현대해상', tel: '15773223' },
    { name: '흥국화재', tel: '16886997' },
    { name: 'DB손보', tel: '15660757' },
    { name: 'KB손보', tel: '15440019' },
    { name: 'MG손보', tel: '15773777' },
  ],
  GENERAL: [
    { name: '삼성화재 일반', tel: '' },
    { name: '현대해상 일반', tel: '' },
    { name: 'DB손보 일반', tel: '' },
    { name: 'KB손보 일반', tel: '' },
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
