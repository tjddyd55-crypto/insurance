import { describe, expect, it } from 'vitest'
import { monthGridRange, periodTitle, shiftAnchor, viewQueryRange, weekDays, weekRange } from './scheduleRange'

describe('schedule range', () => {
  it('월간 그리드·주간·일간 구간이 서버와 같다', () => {
    expect(monthGridRange('2026-10-15')).toMatchObject({
      start: '2026-09-27',
      end: '2026-11-07',
      monthStart: '2026-10-01',
      monthEnd: '2026-10-31',
    })
    expect(weekRange('2026-10-15')).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(viewQueryRange('day', '2026-10-15')).toEqual({ start: '2026-10-15', end: '2026-10-15' })
    expect(viewQueryRange('list', '2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('기간 제목과 이전/다음 이동(월 경계·연 경계)', () => {
    expect(periodTitle('month', '2026-10-02')).toBe('2026년 10월')
    expect(periodTitle('week', '2026-10-02')).toBe('2026.09.28 – 10.04')
    expect(periodTitle('week', '2026-12-31')).toBe('2026.12.28 – 2027.01.03')
    expect(periodTitle('day', '2026-10-02')).toBe('2026년 10월 2일 (금)')
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-01')
    expect(shiftAnchor('week', '2026-10-30', 1)).toBe('2026-11-06')
    expect(shiftAnchor('day', '2026-10-31', 1)).toBe('2026-11-01')
  })

  it('주간은 월요일 시작(월~일, Asia/Seoul): 월요일·일요일 anchor, 월·연 경계', () => {
    // 월요일 anchor 는 그 날이 시작, 일요일 anchor 는 같은 주의 끝
    expect(weekRange('2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(weekRange('2026-10-18')).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(weekRange('2026-10-19')).toEqual({ start: '2026-10-19', end: '2026-10-25' })
    // 지시서 예: 11/02(월)~11/08(일)
    expect(weekRange('2026-11-02')).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(weekRange('2026-11-08')).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    // 월 경계: 11/1(일) 은 10/26~11/01
    expect(weekRange('2026-11-01')).toEqual({ start: '2026-10-26', end: '2026-11-01' })
    expect(weekRange('2026-10-01')).toEqual({ start: '2026-09-28', end: '2026-10-04' })
    // 연 경계: 2027-01-01(금) 은 2026-12-28(월)~2027-01-03(일)
    expect(weekRange('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
    expect(weekRange('2027-01-04')).toEqual({ start: '2027-01-04', end: '2027-01-10' })
    // 윤년 2월 말 → 3월
    expect(weekRange('2028-03-01')).toEqual({ start: '2028-02-28', end: '2028-03-05' })
    // 조회 구간 = 화면 7칸, 첫 칸 월요일
    expect(viewQueryRange('week', '2026-12-31')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
    const days = weekDays('2026-12-31')
    expect(days).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
    for (const ymd of ['2026-10-02', '2026-11-01', '2027-01-01', '2028-02-29']) {
      const [y, m, d] = weekRange(ymd).start.split('-').map(Number)
      expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1)
    }
    // 월간 그리드는 기존대로 일요일 시작(주간 보기만 월요일로 변경)
    expect(new Date(`${monthGridRange('2026-11-15').start}T00:00:00Z`).getUTCDay()).toBe(0)
  })

  it('주간 이전/다음/오늘 이동은 월요일 주 단위로 맞물린다', () => {
    expect(weekRange(shiftAnchor('week', '2026-11-01', 1))).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(weekRange(shiftAnchor('week', '2026-11-02', -1))).toEqual({ start: '2026-10-26', end: '2026-11-01' })
    expect(weekRange(shiftAnchor('week', '2026-12-28', 1))).toEqual({ start: '2027-01-04', end: '2027-01-10' })
    expect(weekRange(shiftAnchor('week', '2027-01-03', -1))).toEqual({ start: '2026-12-21', end: '2026-12-27' })
    expect(periodTitle('week', shiftAnchor('week', '2026-12-24', 1))).toBe('2026.12.28 – 2027.01.03')
  })
})
