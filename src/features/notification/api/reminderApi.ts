import { apiRequest } from '../../../lib/apiClient'

export type ReminderEventType = 'insurance_age_date' | 'car_expiry' | 'special_date'

export type ReminderEvent = {
  id: string
  type: ReminderEventType
  title: string
  startDate: string
  startTime: string | null
  customerId: number
  customerName: string
  phone: string
  assigneeName: string
  content: string
  source: string
  sourceId: number | null
  sourceDate: string | null
  sourceTitle: string | null
  createdAt: string | null
}

export type ReminderDayCount = {
  date: string
  count: number
  types: ReminderEventType[]
}

export const REMINDER_TYPE_LABEL: Record<ReminderEventType, string> = {
  insurance_age_date: '상령일',
  car_expiry: '자동차 만기',
  special_date: '알림일',
}

export type ReminderCalendar = {
  year: number
  month: number
  days: ReminderDayCount[]
  events: ReminderEvent[]
}

const EMPTY_REMINDER_CALENDAR: ReminderCalendar = { year: 0, month: 0, days: [], events: [] }

/**
 * `apiRequest`는 `{ success, data }`를 `data`로 푼다.
 * 풀린 달력과 봉투의 `data` 둘 다 읽는다.
 */
export function readReminderCalendar(payload: unknown): ReminderCalendar {
  if (!payload || typeof payload !== 'object') {
    return EMPTY_REMINDER_CALENDAR
  }
  const body = payload as Partial<ReminderCalendar> & { data?: unknown }
  if ('year' in body || 'month' in body || 'days' in body || 'events' in body) {
    return {
      year: typeof body.year === 'number' ? body.year : 0,
      month: typeof body.month === 'number' ? body.month : 0,
      days: Array.isArray(body.days) ? body.days : [],
      events: Array.isArray(body.events) ? body.events : [],
    }
  }
  if (body.data !== undefined) {
    return readReminderCalendar(body.data)
  }
  return EMPTY_REMINDER_CALENDAR
}

/** 풀린 `{ events }`와 봉투 `{ data: { events } }` 둘 다 읽는다. */
export function readReminderEvents(payload: unknown): ReminderEvent[] {
  if (Array.isArray(payload)) {
    return payload as ReminderEvent[]
  }
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const body = payload as { events?: unknown; data?: unknown }
  if (Array.isArray(body.events)) {
    return body.events as ReminderEvent[]
  }
  if (body.data !== undefined) {
    return readReminderEvents(body.data)
  }
  return []
}

export async function fetchReminderCalendar(token: string, month: string): Promise<ReminderCalendar> {
  const raw = await apiRequest<unknown>(
    `/api/reminders/calendar?month=${encodeURIComponent(month)}`,
    { token },
  )
  return readReminderCalendar(raw)
}

export async function fetchReminderList(
  token: string,
  query: { type?: string; q?: string; from?: string; to?: string; sort?: string },
): Promise<ReminderEvent[]> {
  const params = new URLSearchParams()
  if (query.type) params.set('type', query.type)
  if (query.q) params.set('q', query.q)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.sort) params.set('sort', query.sort)
  const raw = await apiRequest<unknown>(`/api/reminders?${params.toString()}`, { token })
  return readReminderEvents(raw)
}
