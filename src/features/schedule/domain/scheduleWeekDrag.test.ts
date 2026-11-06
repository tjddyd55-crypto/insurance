import { describe, expect, it } from 'vitest'
import type { ScheduleEvent } from '../api/scheduleApi'
import {
  canResizeTimedEvent,
  moveTimedRange,
  pointerExceededThreshold,
  readTimedRange,
  resizeTimedRange,
  timedRangeWriteFields,
} from './scheduleWeekDrag'

function timed(startAt: string, endAt: string, extra: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'e', source: 'google', sourceId: 'src', calendarId: 'primary', calendarName: '',
    type: 'google_event', title: '일정', description: '', startAt, endAt, allDay: false,
    timezone: 'Asia/Seoul', customerId: null, customerName: '', location: '', status: 'confirmed',
    readOnly: false, phone: '', htmlLink: null, sourceDate: null, sourceTitle: null,
    origin: 'onefc', writable: true, ...extra,
  }
}

describe('주간 시간 블록 이동·리사이즈', () => {
  it('같은 날 30분 두 칸(1시간) 이동은 길이를 유지한다', () => {
    const range = readTimedRange(timed('2026-11-06T14:00:00+09:00', '2026-11-06T16:00:00+09:00'))!
    const moved = moveTimedRange(range, 0, 60)
    expect(timedRangeWriteFields(moved)).toEqual({
      date: '2026-11-06', endDate: '2026-11-06', allDay: false, startTime: '15:00', endTime: '17:00',
    })
  })

  it('다른 요일로 옮기면 날짜만 바뀌고 기간은 같다', () => {
    const range = readTimedRange(timed('2026-11-06T09:00:00+09:00', '2026-11-06T10:00:00+09:00'))!
    const moved = moveTimedRange(range, 2, 0)
    expect(timedRangeWriteFields(moved)).toMatchObject({ date: '2026-11-08', endDate: '2026-11-08', startTime: '09:00', endTime: '10:00' })
  })

  it('자정을 넘는 일정은 이동해도 1시간을 유지한다', () => {
    const range = readTimedRange(timed('2026-11-06T23:30:00+09:00', '2026-11-07T00:30:00+09:00'))!
    const moved = moveTimedRange(range, -1, 0)
    expect(timedRangeWriteFields(moved)).toEqual({
      date: '2026-11-05', endDate: '2026-11-06', allDay: false, startTime: '23:30', endTime: '00:30',
    })
    expect(canResizeTimedEvent(timed('2026-11-06T23:30:00+09:00', '2026-11-07T00:30:00+09:00'))).toBe(false)
  })

  it('같은 날 하단 리사이즈는 30분 단위이고 최소 30분이다', () => {
    const range = readTimedRange(timed('2026-11-06T14:00:00+09:00', '2026-11-06T15:00:00+09:00'))!
    expect(timedRangeWriteFields(resizeTimedRange(range, 'end', 16 * 60)!)).toMatchObject({ endTime: '16:00' })
    expect(timedRangeWriteFields(resizeTimedRange(range, 'end', 14 * 60 + 10)!)).toMatchObject({ startTime: '14:00', endTime: '14:30' })
    expect(resizeTimedRange(range, 'start', 14 * 60 + 50)?.startMinute).toBe(14 * 60 + 30)
  })

  it('자정을 넘는 일정은 리사이즈하지 않는다', () => {
    const range = readTimedRange(timed('2026-11-06T23:00:00+09:00', '2026-11-07T00:30:00+09:00'))!
    expect(resizeTimedRange(range, 'end', 23 * 60 + 30)).toBeNull()
  })

  it('6px 미만은 클릭, 그 이상은 드래그다', () => {
    expect(pointerExceededThreshold(3, 4)).toBe(false)
    expect(pointerExceededThreshold(6, 0)).toBe(true)
    expect(pointerExceededThreshold(0, 8)).toBe(true)
  })
})
