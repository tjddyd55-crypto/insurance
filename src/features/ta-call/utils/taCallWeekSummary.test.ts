import { describe, expect, it } from 'vitest'
import type { TaCallDay } from '../types/taCall.types'
import {
  buildTaWeekSummaryItems,
  formatTaWeekRangeCompactLabel,
  resolveTaWeekSummaryProgressPercent,
  resolveTaWeekSummaryStatus,
} from './taCallWeekSummary'

function makeDay(overrides: Partial<TaCallDay>): TaCallDay {
  return {
    date: '2026-07-01',
    dailyTargetCount: 10,
    totalCount: 10,
    completedCount: 0,
    noAnswerCount: 0,
    notCalledCount: 10,
    isToday: false,
    isFuture: false,
    isMissionCompleted: false,
    assignments: [],
    ...overrides,
  }
}

describe('taCallWeekSummary', () => {
  it('formats compact week range labels', () => {
    expect(formatTaWeekRangeCompactLabel('2026-06-28', '2026-07-04')).toBe('06.28 ~ 07.04')
  })

  it('marks future days as scheduled', () => {
    const status = resolveTaWeekSummaryStatus(makeDay({ isFuture: true, totalCount: 0 }))
    expect(status).toBe('scheduled')
  })

  it('marks past days without assignments as empty', () => {
    const status = resolveTaWeekSummaryStatus(makeDay({ totalCount: 0, isFuture: false }))
    expect(status).toBe('empty')
  })

  it('marks today as today even when incomplete', () => {
    const status = resolveTaWeekSummaryStatus(
      makeDay({ isToday: true, completedCount: 3, totalCount: 10, isMissionCompleted: false }),
    )
    expect(status).toBe('today')
  })

  it('marks completed days when target reached', () => {
    const status = resolveTaWeekSummaryStatus(
      makeDay({ completedCount: 10, dailyTargetCount: 10, isMissionCompleted: true }),
    )
    expect(status).toBe('completed')
  })

  it('calculates progress percent from completed/target counts', () => {
    expect(resolveTaWeekSummaryProgressPercent(makeDay({ completedCount: 3, dailyTargetCount: 10 }))).toBe(30)
    expect(resolveTaWeekSummaryProgressPercent(makeDay({ completedCount: 12, dailyTargetCount: 10 }))).toBe(100)
  })

  it('builds row items with weekday and display date labels', () => {
    const items = buildTaWeekSummaryItems([
      makeDay({ date: '2026-06-29', completedCount: 10, isMissionCompleted: true }),
      makeDay({ date: '2026-07-02', isFuture: true, totalCount: 0 }),
    ])

    expect(items[0]?.displayDate).toBe('6/29')
    expect(items[0]?.status).toBe('completed')
    expect(items[1]?.status).toBe('scheduled')
  })
})
