import { describe, expect, it } from 'vitest'
import { initialCreateDueDate } from './defaultTodoDueDate'

describe('initialCreateDueDate', () => {
  it('넘겨받은 날짜 > 본문 제안 > 오늘(KST)', () => {
    expect(initialCreateDueDate({ explicit: '2026-10-20', suggested: '2026-10-15', todayDefault: true })).toBe('2026-10-20')
    expect(initialCreateDueDate({ explicit: null, suggested: '2026-10-15', todayDefault: true })).toBe('2026-10-15')
  })
  it('KST 자정 경계에서 하루 밀리지 않는다', () => {
    // 2026-10-14 00:30 KST = 2026-10-13T15:30Z
    expect(initialCreateDueDate({ todayDefault: true, now: new Date('2026-10-13T15:30:00Z') })).toBe('2026-10-14')
    // 2026-10-14 23:59 KST = 2026-10-14T14:59Z
    expect(initialCreateDueDate({ todayDefault: true, now: new Date('2026-10-14T14:59:00Z') })).toBe('2026-10-14')
    // 2026-10-15 00:00 KST
    expect(initialCreateDueDate({ todayDefault: true, now: new Date('2026-10-14T15:00:00Z') })).toBe('2026-10-15')
  })
  it('todayDefault 가 아니면 비워 둔다(기존 동작)', () => {
    expect(initialCreateDueDate({ todayDefault: false })).toBe('')
    expect(initialCreateDueDate({ explicit: 'bad', todayDefault: false })).toBe('')
  })
})
