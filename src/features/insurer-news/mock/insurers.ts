import type { InsurerSummary } from '../types'

/** GA별 보험사 목록 (mock). 동일 보험사명이라도 gaCode가 다르면 별도 행. */
export const MOCK_INSURERS: InsurerSummary[] = [
  {
    gaCode: 'YJASSET',
    insurerCode: 'DB',
    insurerName: 'DB손해보험',
    insurerSlug: 'db',
    newsletterCount: 4,
    lastPublishedAt: '2025-03-28T09:30:00+09:00',
  },
  {
    gaCode: 'YJASSET',
    insurerCode: 'HD',
    insurerName: '현대해상',
    insurerSlug: 'hyundai',
    newsletterCount: 2,
    lastPublishedAt: '2025-03-25T14:00:00+09:00',
  },
  {
    gaCode: 'OTHER01',
    insurerCode: 'DB',
    insurerName: 'DB손해보험',
    insurerSlug: 'db',
    newsletterCount: 2,
    lastPublishedAt: '2025-03-20T11:00:00+09:00',
  },
]

export function mockInsurersForGa(gaCode: string): InsurerSummary[] {
  const c = gaCode.trim().toUpperCase()
  return MOCK_INSURERS.filter((x) => x.gaCode === c)
}
