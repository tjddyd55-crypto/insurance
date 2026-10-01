import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchReminderCalendar, fetchReminderList, type ReminderEvent } from './reminderApi'

vi.mock('../../../lib/apiClient', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../../../lib/apiClient'

const mockedApiRequest = vi.mocked(apiRequest)

const event = {
  id: 'e1',
  type: 'special_date',
  title: '알림',
  startDate: '2026-10-02',
  startTime: null,
  customerId: 3,
  customerName: '김민수',
  phone: '010',
  assigneeName: '담당',
  content: '',
  source: 'special_date',
  sourceId: 1,
  sourceDate: '2026-10-02',
  sourceTitle: '알림',
  createdAt: null,
} satisfies ReminderEvent

const calendar = {
  year: 2026,
  month: 10,
  days: [{ date: '2026-10-02', count: 1, types: ['special_date' as const] }],
  events: [event],
}

describe('reminderApi unwrap', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
  })

  it('reads the calendar after apiRequest unwraps the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce(calendar)
    await expect(fetchReminderCalendar('token', '2026-10')).resolves.toEqual(calendar)
  })

  it('reads the calendar when apiRequest still returns the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce({ success: true, data: calendar })
    await expect(fetchReminderCalendar('token', '2026-10')).resolves.toEqual(calendar)
  })

  it('reads events after apiRequest unwraps the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce({ events: [event] })
    await expect(fetchReminderList('token', { type: 'special_date' })).resolves.toEqual([event])
  })

  it('reads events when apiRequest still returns the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce({ success: true, data: { events: [event] } })
    await expect(fetchReminderList('token', {})).resolves.toEqual([event])
  })
})
