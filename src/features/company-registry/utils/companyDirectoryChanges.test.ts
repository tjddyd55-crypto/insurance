import { describe, expect, it } from 'vitest'
import { buildCompanyChangeSummaries } from './companyDirectoryChanges'
import type { CompanyHistorySnapshot, CompanyUpdateHistoryItem } from '../domain/types'

function snapshot(partial: Partial<CompanyHistorySnapshot>): CompanyHistorySnapshot {
  return {
    customerCenter: '',
    system: '',
    incall: '',
    visitInfo: '',
    contacts: [],
    ...partial,
  }
}

function historyItem(
  overrides: Partial<CompanyUpdateHistoryItem> &
    Pick<CompanyUpdateHistoryItem, 'id' | 'companyId' | 'updatedAt' | 'savedAt' | 'before' | 'after'>,
): CompanyUpdateHistoryItem {
  return {
    companyName: '테스트손보',
    updatedBy: 'staff',
    ...overrides,
  }
}

describe('buildCompanyChangeSummaries', () => {
  it('가장 최근 저장 1건의 diff 필드만 강조한다 (과거 변경은 검정 복귀)', () => {
    // 과거(06-09): 고객센터 변경 / 최신(07-08): 지점장 전화만 변경
    const history: CompanyUpdateHistoryItem[] = [
      historyItem({
        id: '1',
        companyId: '10',
        updatedAt: '2026-06-09',
        savedAt: '2026-06-09T01:00:00.000Z',
        before: snapshot({ customerCenter: '15881000' }),
        after: snapshot({ customerCenter: '15882000' }),
      }),
      historyItem({
        id: '2',
        companyId: '10',
        updatedAt: '2026-07-08',
        savedAt: '2026-07-08T01:00:00.000Z',
        before: snapshot({
          customerCenter: '15882000',
          contacts: [{ position: '지점장', name: '홍길동', phone: '01011112222' }],
        }),
        after: snapshot({
          customerCenter: '15882000',
          contacts: [{ position: '지점장', name: '홍길동', phone: '01033334444' }],
        }),
      }),
    ]

    const summaries = buildCompanyChangeSummaries(history)
    const summary = summaries.get('10')
    expect(summary).toBeDefined()
    // 기준일 배지는 가장 최근 수정일
    expect(summary?.updatedAt).toBe('2026-07-08')
    // 최신 저장에서 고객센터는 변화 없음 → 검정(강조 없음)
    expect(summary?.customerCenterChanged).toBe(false)
    // 최신 저장에서 지점장 전화만 변경 → 빨강
    const branchManager = summary?.contactChangesByRole.get('지점장')
    expect(branchManager?.phoneChanged).toBe(true)
    expect(branchManager?.nameChanged).toBe(false)
  })

  it('가장 최근 저장 로그가 없으면 요약이 없다 (배지·강조 없음)', () => {
    expect(buildCompanyChangeSummaries([]).size).toBe(0)
  })
})
