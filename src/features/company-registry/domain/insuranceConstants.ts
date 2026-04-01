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

/**
 * 최종 보험사 데이터 (표준 고객센터 번호).
 * — GENERAL은 현재 맵 비움(직접 입력만).
 */
export const insuranceCompanyMap: Record<InsuranceCategory, InsuranceCompanyOption[]> = {
  LIFE: [
    { name: '한화생명', tel: '1588-6363' },
    { name: 'ABL생명', tel: '1588-6500' },
    { name: '삼성생명', tel: '1588-3114' },
    { name: '흥국생명', tel: '1588-2288' },
    { name: '교보생명', tel: '1588-1001' },
    { name: 'IM라이프', tel: '1588-4770' },
    { name: '라이나생명', tel: '1588-0058' },
    { name: '신한라이프', tel: '1588-5580' },
    { name: '메트라이프', tel: '1588-9600' },
    { name: '동양생명', tel: '1577-1004' },
    { name: '미래에셋생명', tel: '1588-0220' },
    { name: 'KB생명', tel: '1588-3374' },
    { name: '처브생명', tel: '1599-4600' },
    { name: '하나생명', tel: '1577-1112' },
    { name: '농협생명', tel: '1544-4000' },
  ],
  NON_LIFE: [
    { name: '메리츠화재', tel: '1566-7711' },
    { name: '한화손해보험', tel: '1566-8000' },
    { name: '롯데손해보험', tel: '1588-3344' },
    { name: 'MG손해보험', tel: '1588-5959' },
    { name: '흥국화재', tel: '1688-1688' },
    { name: '삼성화재', tel: '1588-5114' },
    { name: '현대해상', tel: '1588-5656' },
    { name: 'KB손해보험', tel: '1544-0114' },
    { name: 'DB손해보험', tel: '1588-0100' },
    { name: '에이스손해보험', tel: '1566-5800' },
    { name: 'AIG손해보험', tel: '1544-2792' },
    { name: 'NH농협손해보험', tel: '1644-9000' },
    { name: '라이나손해보험', tel: '1588-0058' },
    { name: '하나손해보험', tel: '1566-3000' },
    { name: '우체국보험', tel: '1599-0100' },
  ],
  GENERAL: [],
}

/** 드롭다운 표시용 보험사 이름 목록 (insuranceCompanyMap과 동기화) */
export const INSURANCE_COMPANIES_BY_TYPE: Record<InsuranceCategory, string[]> = {
  LIFE: insuranceCompanyMap.LIFE.map((c) => c.name),
  NON_LIFE: insuranceCompanyMap.NON_LIFE.map((c) => c.name),
  GENERAL: insuranceCompanyMap.GENERAL.map((c) => c.name),
}

/** 맵에 있는 표준 고객센터 번호(없으면 빈 문자열 → 직접 입력 유도) */
export function getInsuranceCompanyDefaultTel(category: InsuranceCategory, companyName: string): string {
  const q = String(companyName ?? '').trim()
  if (!q) {
    return ''
  }
  const row = insuranceCompanyMap[category]?.find((c) => c.name === q)
  return String(row?.tel ?? '').trim()
}
