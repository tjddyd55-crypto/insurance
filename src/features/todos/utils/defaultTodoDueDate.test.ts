import { describe, expect, it } from 'vitest'
import { initialCreateDueDate } from './defaultTodoDueDate'

describe('initialCreateDueDate', () => {
  it('달력에서 고른 날을 문자열 그대로 쓴다(시간대로 하루를 밀지 않음)', () => {
    // now 가 KST 10/14 여도 고른 10/20 은 그대로다.
    expect(initialCreateDueDate({
      explicit: '2026-10-20',
      now: new Date('2026-10-13T15:30:00Z'),
    })).toBe('2026-10-20')
    expect(initialCreateDueDate({ explicit: ' 2026-10-20 ' })).toBe('2026-10-20')
  })

  it('고른 날이 없으면 오늘(KST)이고 자정 경계에서 하루 밀리지 않는다', () => {
    // 2026-10-14 00:30 KST = 2026-10-13T15:30Z
    expect(initialCreateDueDate({ now: new Date('2026-10-13T15:30:00Z') })).toBe('2026-10-14')
    expect(initialCreateDueDate({ explicit: null, now: new Date('2026-10-13T15:30:00Z') })).toBe('2026-10-14')
    expect(initialCreateDueDate({ explicit: '', now: new Date('2026-10-13T15:30:00Z') })).toBe('2026-10-14')
    // 2026-10-14 23:59 KST = 2026-10-14T14:59Z
    expect(initialCreateDueDate({ now: new Date('2026-10-14T14:59:00Z') })).toBe('2026-10-14')
    // 2026-10-15 00:00 KST
    expect(initialCreateDueDate({ now: new Date('2026-10-14T15:00:00Z') })).toBe('2026-10-15')
  })

  it('날짜가 아닌 값은 고른 날로 보지 않고 오늘(KST)로 둔다', () => {
    expect(initialCreateDueDate({
      explicit: 'bad',
      now: new Date('2026-10-13T15:30:00Z'),
    })).toBe('2026-10-14')
    expect(initialCreateDueDate({
      explicit: '2026-10-20T00:00:00Z',
      now: new Date('2026-10-13T15:30:00Z'),
    })).toBe('2026-10-14')
  })
})
