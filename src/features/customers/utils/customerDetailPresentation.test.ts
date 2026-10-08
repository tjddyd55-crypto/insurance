import { describe, expect, it } from 'vitest'

import { getInsuranceAgeDdayLabel, resolveInsuranceAgeTargetDate } from './customerDetailPresentation'

describe('customerDetailPresentation (Native parity)', () => {
  it('rolls forward past 상령일 to next annual occurrence', () => {
    const resolved = resolveInsuranceAgeTargetDate('2020-03-15', new Date('2026-10-08T12:00:00+09:00'))
    expect(resolved).toBe('2027-03-15')
  })

  it('labels D-day and today like Native', () => {
    expect(getInsuranceAgeDdayLabel('2026-10-08', new Date('2026-10-08T12:00:00+09:00'))).toBe('오늘')
    expect(getInsuranceAgeDdayLabel('2026-10-10', new Date('2026-10-08T12:00:00+09:00'))).toBe('D-2')
  })
})
