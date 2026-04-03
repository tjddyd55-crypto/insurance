import type { InsurerManagerType } from '../types'

export const INSURANCE_COMPANIES_BY_TYPE: Record<InsurerManagerType, string[]> = {
  LIFE: ['삼성생명', '한화생명', '교보생명', '신한라이프', '미래에셋생명', '동양생명', 'KB라이프생명'],
  NON_LIFE: [
    '삼성화재',
    '현대해상',
    'DB손해보험',
    'KB손해보험',
    '메리츠화재',
    '롯데손해보험',
    'NH손해보험',
    '하나손해보험',
    '악사손해보험',
    '흥국화재',
  ],
}

export function insurersForType(t: InsurerManagerType): string[] {
  return [...INSURANCE_COMPANIES_BY_TYPE[t]]
}
