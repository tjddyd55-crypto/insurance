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

export async function fetchReminderCalendar(token: string, month: string): Promise<{
  year: number
  month: number
  days: ReminderDayCount[]
  events: ReminderEvent[]
}> {
  const raw = await apiRequest<{
    success: boolean
    data: { year: number; month: number; days: ReminderDayCount[]; events: ReminderEvent[] }
  }>(`/api/reminders/calendar?month=${encodeURIComponent(month)}`, { token })
  return raw.data
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
  const raw = await apiRequest<{ success: boolean; data: { events: ReminderEvent[] } }>(
    `/api/reminders?${params.toString()}`,
    { token },
  )
  return raw.data?.events ?? []
}
