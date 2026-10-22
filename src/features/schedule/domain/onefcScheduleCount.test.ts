import { describe, expect, it } from 'vitest'
import type { ScheduleEvent } from '../api/scheduleApi'
import { countScheduleItemsByDate } from './scheduleDayCount'
import baseline from '../../../../server/schedule/__fixtures__/scheduleBaseline.json'

function localEvent(partial: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: 'onefc:1',
    source: 'google',
    sourceId: '1',
    calendarId: null,
    calendarName: 'ONE FC',
    type: 'google_event',
    title: '상담',
    description: '',
    startAt: '2026-10-22T10:00:00+09:00',
    endAt: '2026-10-22T11:00:00+09:00',
    allDay: false,
    timezone: 'Asia/Seoul',
    customerId: null,
    customerName: '',
    location: '',
    status: 'confirmed',
    readOnly: false,
    phone: '',
    htmlLink: null,
    sourceDate: null,
    sourceTitle: null,
    origin: 'onefc',
    ...partial,
  }
}

describe('ONE FC 일정 배지', () => {
  it('기존 기준선 배지는 그대로다', () => {
    expect(baseline.expectedBadge).toEqual({ '2026-10-22': 6, '2026-10-25': 1 })
  })

  it('로컬 일정 1건은 하루에 1이고 종일 종료일(exclusive)은 세지 않는다', () => {
    const timed = countScheduleItemsByDate([localEvent({})], [])
    expect(timed.get('2026-10-22')).toBe(1)
    expect(timed.size).toBe(1)
    const allDay = countScheduleItemsByDate([
      localEvent({ allDay: true, startAt: '2026-10-22', endAt: '2026-10-23' }),
    ], [])
    expect(allDay.get('2026-10-22')).toBe(1)
    expect(allDay.get('2026-10-23')).toBeUndefined()
  })
})
