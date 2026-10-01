import { describe, expect, it } from 'vitest'

import {
  formatConsultationListDate,
  formatCoveragePrintDate,
  formatCoverageSeoulDateTimeLabel,
  formatCoverageSeoulYmd,
  formatCoverageShareMetaDate,
} from './formatConsultationDate'

describe('coverage simulator Seoul dates', () => {
  it('shows 2026-09-30T16:30:00Z as 2026.10.01', () => {
    const instant = '2026-09-30T16:30:00Z'
    expect(formatConsultationListDate(instant)).toBe('2026.10.01')
    expect(formatCoveragePrintDate(instant)).toBe('2026.10.01')
    expect(formatCoverageShareMetaDate(instant)).toBe('2026.10.01')
    expect(formatCoverageSeoulDateTimeLabel(instant)).toBe('2026.10.01 01:30')
  })

  it('keeps a date-only consultation day', () => {
    expect(formatCoverageSeoulYmd('2026-09-30')).toBe('2026-09-30')
    expect(formatConsultationListDate('2026-09-30')).toBe('2026.09.30')
    expect(formatCoveragePrintDate('2026-09-30')).toBe('2026.09.30')
    expect(formatCoverageShareMetaDate('2026-09-30')).toBe('2026.09.30')
  })

  it('uses an em dash for a missing list or print date and an empty share meta', () => {
    expect(formatConsultationListDate(null)).toBe('—')
    expect(formatCoveragePrintDate('')).toBe('—')
    expect(formatCoverageShareMetaDate(undefined)).toBe('')
  })
})
