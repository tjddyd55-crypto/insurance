import { apiRequest } from '../../../lib/apiClient'

export type ScheduleSource = 'google' | 'customer_alert' | 'car_expiry' | 'insurance_age' | 'personal'

export type ScheduleEvent = {
  id: string
  source: ScheduleSource
  sourceId: string
  type: string
  title: string
  startAt: string
  endAt: string
  allDay: boolean
  customerId: number | null
  customerName: string
  description: string
  status: string
  phone: string
  htmlLink: string | null
  etag: string | null
  sourceDate: string | null
  sourceTitle: string | null
}

export type ScheduleGoogleState = {
  configured: boolean
  connected: boolean
  status: 'unconfigured' | 'disconnected' | 'connected' | 'error' | 'skipped'
}

export type ScheduleEventsResponse = {
  from: string
  to: string
  sources: ScheduleSource[]
  google: ScheduleGoogleState
  events: ScheduleEvent[]
}

export const SCHEDULE_SOURCE_LABEL: Record<ScheduleSource, string> = {
  google: 'Google',
  customer_alert: '고객 알림',
  car_expiry: '자동차 만기',
  insurance_age: '상령일',
  personal: '개인 일정',
}

export async function fetchScheduleEvents(
  token: string,
  query: { from: string; to: string; sources: ScheduleSource[] },
): Promise<ScheduleEventsResponse> {
  const params = new URLSearchParams()
  params.set('from', query.from)
  params.set('to', query.to)
  params.set('sources', query.sources.join(','))
  const raw = await apiRequest<{ success: boolean; data: ScheduleEventsResponse }>(
    `/api/schedule/events?${params.toString()}`,
    { token },
  )
  return raw.data
}
