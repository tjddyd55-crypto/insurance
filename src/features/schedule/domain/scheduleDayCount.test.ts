import { describe, expect, it } from 'vitest'
import type { ScheduleEvent, ScheduleTask } from '../api/scheduleApi'
import { countScheduleItemsByDate, dayCountLabel } from './scheduleDayCount'
import fixture from './__fixtures__/scheduleDayCountCases.json'

describe('countScheduleItemsByDate (공통 fixture)', () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const counts = countScheduleItemsByDate(c.events as unknown as ScheduleEvent[], c.tasks as unknown as ScheduleTask[])
      expect(Object.fromEntries(counts)).toEqual(c.expect)
      for (const [date, label] of Object.entries(c.label)) expect(dayCountLabel(counts.get(date) ?? 0)).toBe(label)
    })
  }
  it('labels 0, 1, 9, 10', () => {
    expect([0, 1, 9, 10, 57].map(dayCountLabel)).toEqual(['', '1', '9', '9+', '9+'])
  })
})
