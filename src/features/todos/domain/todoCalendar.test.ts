import { describe, expect, it } from 'vitest'

import type { TodoDto } from './todoTypes'
import {
  buildCalendarMatrix,
  getCalendarMonthRange,
  groupTodosByDueDate,
  shiftCalendarMonth,
} from './todoCalendar'

function todo(id: string, dueDate: string | null, dueTime: string | null = null): TodoDto {
  return {
    id,
    tenantId: null,
    gaId: 1,
    ownerUserId: 'user-1',
    assigneeUserId: null,
    title: id,
    description: id,
    dueDate,
    dueTime,
    status: 'pending',
    priority: 'normal',
    sourceType: 'manual',
    sourceId: null,
    relatedEntityType: null,
    relatedEntityId: null,
    metadata: null,
    createdAt: null,
    updatedAt: null,
    completedAt: null,
    canceledAt: null,
    customerName: null,
  }
}

describe('todoCalendar', () => {
  it('builds a stable six-week Sunday-first matrix', () => {
    const days = buildCalendarMatrix('2026-10')
    expect(days).toHaveLength(42)
    expect(days[0]?.date).toBe('2026-09-27')
    expect(days[41]?.date).toBe('2026-11-07')
    expect(days.find((day) => day.date === '2026-10-01')?.inCurrentMonth).toBe(true)
  })

  it('handles leap-year month ranges and month shifts', () => {
    expect(getCalendarMonthRange('2028-02')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
    expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01')
  })

  it('groups dated todos and orders them by time', () => {
    const grouped = groupTodosByDueDate([
      todo('later', '2026-10-15', '14:00'),
      todo('undated', null),
      todo('early', '2026-10-15', '09:00'),
    ])
    expect(grouped.get('2026-10-15')?.map((entry) => entry.id)).toEqual(['early', 'later'])
    expect(grouped.has('')).toBe(false)
  })
})
