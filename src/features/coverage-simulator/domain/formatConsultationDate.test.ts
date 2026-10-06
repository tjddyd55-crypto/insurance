import { describe, expect, it } from 'vitest'

import {
  formatConsultationListDate,
  formatCoveragePrintDate,
  formatCoverageSeoulYmd,
  formatCoverageShareMetaDate,
  seoulTodayYmd,
} from './formatConsultationDate'

const CREATED_AT_KST_OCT_1 = '2026-09-30T16:16:00Z'

describe('coverage simulator authored date', () => {
  it('shows 2026-09-30T16:16:00Z as 2026.10.01 on list, print, and public share', () => {
    const record = {
      createdAt: CREATED_AT_KST_OCT_1,
      consultationDate: '2026-09-30',
    }
    expect(formatConsultationListDate(CREATED_AT_KST_OCT_1)).toBe('2026.10.01')
    expect(formatCoveragePrintDate(record)).toBe('2026.10.01')
    expect(formatCoverageShareMetaDate(record)).toBe('2026.10.01')
  })

  it('keeps a date-only consultation day when createdAt is absent', () => {
    const record = { consultationDate: '2026-09-30' }
    expect(formatCoverageSeoulYmd('2026-09-30')).toBe('2026-09-30')
    expect(formatConsultationListDate('2026-09-30')).toBe('2026.09.30')
    expect(formatCoveragePrintDate(record)).toBe('2026.09.30')
    expect(formatCoverageShareMetaDate(record)).toBe('2026.09.30')
  })

  it('stores a new consultation day as the Seoul calendar date', () => {
    expect(seoulTodayYmd(new Date(CREATED_AT_KST_OCT_1))).toBe('2026-10-01')
  })

  it('uses an em dash for a missing list or print date and an empty share meta', () => {
    expect(formatConsultationListDate(null)).toBe('—')
    expect(formatCoveragePrintDate({})).toBe('—')
    expect(formatCoverageShareMetaDate({})).toBe('')
  })
})
