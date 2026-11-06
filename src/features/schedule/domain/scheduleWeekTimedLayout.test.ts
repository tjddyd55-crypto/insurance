import { describe, expect, it } from 'vitest'
import type { ScheduleEvent } from '../api/scheduleApi'
import { timedEventRangeLabel, WEEK_SLOT_MINUTES, weekTimedSegments } from './scheduleWeekTimedLayout'

const WEEK = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']

function timed(startAt: string, endAt: string, extra: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: extra.id ?? `${startAt}-${endAt}`,
    source: 'google',
    sourceId: 'src',
    calendarId: 'primary',
    calendarName: '내 캘린더',
    type: 'google_event',
    title: extra.title ?? '일정',
    description: '',
    startAt,
    endAt,
    allDay: false,
    timezone: 'Asia/Seoul',
    customerId: null,
    customerName: '',
    location: '',
    status: 'confirmed',
    readOnly: true,
    phone: '',
    htmlLink: null,
    sourceDate: null,
    sourceTitle: null,
    ...extra,
  }
}

function place(start: string, end: string, extra: Partial<ScheduleEvent> = {}) {
  const segments = weekTimedSegments([timed(start, end, extra)], WEEK)
  expect(segments).toHaveLength(1)
  return segments[0]
}

describe('주간 시간 일정 배치', () => {
  it('09:00-10:00 은 1시간(30분 칸 2개)이다', () => {
    const segment = place('2026-11-06T09:00:00+09:00', '2026-11-06T10:00:00+09:00')
    expect(segment.endMinute - segment.startMinute).toBe(60)
    expect(segment.rowEnd - segment.rowStart).toBe(60 / WEEK_SLOT_MINUTES)
    expect(segment.startMinute).toBe(9 * 60)
    expect(timedEventRangeLabel(segment.event)).toBe('09:00 - 10:00')
  })

  it('14:00-16:00 은 2시간이다', () => {
    const segment = place('2026-11-06T14:00:00+09:00', '2026-11-06T16:00:00+09:00')
    expect(segment.endMinute - segment.startMinute).toBe(120)
    expect(segment.rowEnd - segment.rowStart).toBe(4)
  })

  it('14:30-15:30 은 14:30 칸에서 시작한다', () => {
    const segment = place('2026-11-06T14:30:00+09:00', '2026-11-06T15:30:00+09:00')
    expect(segment.startMinute).toBe(14 * 60 + 30)
    expect(segment.rowStart).toBe(Math.floor(segment.startMinute / WEEK_SLOT_MINUTES) + 1)
    expect(segment.rowEnd - segment.rowStart).toBe(2)
    expect(timedEventRangeLabel(segment.event)).toBe('14:30 - 15:30')
  })

  it('14:00-14:30 은 30분 한 칸이고 1시간으로 늘리지 않는다', () => {
    const segment = place('2026-11-06T14:00:00+09:00', '2026-11-06T14:30:00+09:00')
    expect(segment.endMinute - segment.startMinute).toBe(30)
    expect(segment.rowEnd - segment.rowStart).toBe(1)
  })

  it('23:00-23:59 는 마지막 30분 칸까지 포함한다', () => {
    const segment = place('2026-11-06T23:00:00+09:00', '2026-11-06T23:59:00+09:00')
    expect(segment.startMinute).toBe(23 * 60)
    expect(segment.endMinute).toBe(23 * 60 + 59)
    expect(segment.rowEnd).toBe(49)
    expect(timedEventRangeLabel(segment.event)).toBe('23:00 - 23:59')
  })

  it('23:30 에서 다음날 00:30 은 자정으로 자르지 않고 이틀로 나눈다', () => {
    const segments = weekTimedSegments([
      timed('2026-11-06T23:30:00+09:00', '2026-11-07T00:30:00+09:00', { title: '야간' }),
    ], WEEK)
    expect(segments.map((segment) => [segment.date, segment.startMinute, segment.endMinute])).toEqual([
      ['2026-11-06', 23 * 60 + 30, 24 * 60],
      ['2026-11-07', 0, 30],
    ])
    expect(segments[0].endMinute).not.toBe(23 * 60 + 59)
    expect(timedEventRangeLabel(segments[0].event)).toBe('23:30 - 00:30')
  })

  it('UTC 시각은 서울 시·분으로 놓는다', () => {
    const segment = place('2026-11-06T05:30:00Z', '2026-11-06T07:00:00Z')
    expect(segment.date).toBe('2026-11-06')
    expect(segment.startMinute).toBe(14 * 60 + 30)
    expect(segment.endMinute).toBe(16 * 60)
  })

  it('종일 일정과 주 밖 구간은 시간 축에 올리지 않는다', () => {
    const segments = weekTimedSegments([
      timed('2026-11-06', '2026-11-07', { allDay: true, title: '종일' }),
      timed('2026-11-09T09:00:00+09:00', '2026-11-09T10:00:00+09:00', { title: '다음 주' }),
    ], WEEK)
    expect(segments).toEqual([])
  })

  it('종료가 시작과 같으면 1시간이 아니다', () => {
    const segment = place('2026-11-06T09:00:00+09:00', '2026-11-06T09:00:00+09:00')
    expect(segment.endMinute - segment.startMinute).toBe(0)
    expect(segment.rowEnd - segment.rowStart).toBe(1)
  })

  it('겹치는 일정만 나란히 두고 떨어진 일정은 칸 전체를 쓴다', () => {
    const segments = weekTimedSegments([
      timed('2026-11-06T09:00:00+09:00', '2026-11-06T11:00:00+09:00', { id: 'a', title: '가' }),
      timed('2026-11-06T10:00:00+09:00', '2026-11-06T12:00:00+09:00', { id: 'b', title: '나' }),
      timed('2026-11-06T15:00:00+09:00', '2026-11-06T16:00:00+09:00', { id: 'c', title: '다' }),
    ], WEEK)
    const lanes = Object.fromEntries(segments.map((segment) => [segment.event.id, [segment.lane, segment.laneCount]]))
    expect(lanes.a[1]).toBe(2)
    expect(lanes.b[1]).toBe(2)
    expect(lanes.a[0]).not.toBe(lanes.b[0])
    expect(lanes.c).toEqual([0, 1])
  })
})
