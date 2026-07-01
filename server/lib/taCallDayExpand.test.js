import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDefaultExpandedDates,
  isDayExpanded,
  toggleExpandedDate,
} from '../../shared/taCallDayExpand.js'

test('buildDefaultExpandedDates expands only today when present', () => {
  const week = {
    weekStartDate: '2026-06-29',
    weekEndDate: '2026-07-05',
    dailyTargetCount: 10,
    days: [
      { date: '2026-06-29', isToday: false, isFuture: false },
      { date: '2026-07-01', isToday: true, isFuture: false },
      { date: '2026-07-02', isToday: false, isFuture: true },
    ],
  }
  const expanded = buildDefaultExpandedDates(week)
  assert.deepEqual([...expanded], ['2026-07-01'])
})

test('buildDefaultExpandedDates collapses all when today is absent', () => {
  const week = {
    weekStartDate: '2026-06-15',
    weekEndDate: '2026-06-21',
    dailyTargetCount: 10,
    days: [{ date: '2026-06-15', isToday: false, isFuture: false }],
  }
  assert.equal(buildDefaultExpandedDates(week).size, 0)
})

test('toggleExpandedDate toggles a single date', () => {
  let expanded = new Set(['2026-07-01'])
  expanded = toggleExpandedDate(expanded, '2026-06-30')
  assert.ok(isDayExpanded(expanded, '2026-07-01'))
  assert.ok(isDayExpanded(expanded, '2026-06-30'))

  expanded = toggleExpandedDate(expanded, '2026-07-01')
  assert.equal(isDayExpanded(expanded, '2026-07-01'), false)
})
