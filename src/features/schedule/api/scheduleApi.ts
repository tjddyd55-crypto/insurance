import { apiRequest } from '../../../lib/apiClient'

/** 화면 필터 키. Google 일정은 'google', 할 일은 출처, CRM 은 type 기준. */
export type ScheduleFilterKey = 'google' | 'google_task' | 'onefc_todo' | 'customer_alert' | 'car_expiry' | 'insurance_age'

export type ScheduleTaskSource = 'google_task' | 'onefc_todo'

export type ScheduleEventType = 'google_event' | 'customer_alert' | 'car_expiry' | 'insurance_age'

/** 서버 공통 일정 모델. UI 는 Google 원본을 해석하지 않는다. */
export type ScheduleEvent = {
  id: string
  source: 'google' | 'crm'
  sourceId: string
  calendarId: string | null
  calendarName: string
  type: ScheduleEventType
  title: string
  description: string
  /** 종일: YYYY-MM-DD, 시간: RFC3339(오프셋 포함) */
  startAt: string
  /** 종일: exclusive YYYY-MM-DD */
  endAt: string
  allDay: boolean
  timezone: string
  customerId: number | null
  customerName: string
  location: string
  status: string
  readOnly: boolean
  phone: string
  htmlLink: string | null
  sourceDate: string | null
  sourceTitle: string | null
}

/**
 * 할 일 공통 모델(Google Tasks · ONE FC 할 일). 시간 축에 올리지 않는다.
 * dueDate 는 달력일 문자열(YYYY-MM-DD) 그대로 쓰고 Date 로 바꾸지 않는다.
 */
export type ScheduleTask = {
  id: string
  source: ScheduleTaskSource
  sourceId: string
  taskListId: string | null
  taskListName: string
  title: string
  notes: string
  dueDate: string | null
  /** ONE FC 할 일에 시각이 저장된 경우만(Google Tasks 는 항상 null) */
  dueTime: string | null
  status: 'open' | 'completed'
  completedAt: string | null
  parentId: string | null
  updatedAt: string | null
  customerId: number | null
  customerName: string
  readOnly: boolean
}

export type GoogleCalendarSummary = {
  id: string
  name: string
  primary: boolean
  accessRole: string
  timezone: string
  selected: boolean
  defaultVisible: boolean
}

export type ScheduleGoogleStatus = 'unconfigured' | 'disconnected' | 'connected' | 'needs_reauth' | 'error' | 'skipped'

export type ScheduleGoogleTasksStatus = 'unconfigured' | 'disconnected' | 'connected' | 'needs_reauth' | 'scope_missing' | 'error' | 'skipped'

export type ScheduleGoogleTasksState = {
  status: ScheduleGoogleTasksStatus
  /** 저장된 동의에 tasks.readonly 가 없음 → 같은 연결 흐름으로 다시 연결 */
  needsReconsent: boolean
  taskLists: Array<{ id: string; name: string }>
}

export type ScheduleGoogleState = {
  configured: boolean
  connected: boolean
  status: ScheduleGoogleStatus
  /** false 면 이 사용자는 아직 Google 연결을 시작할 수 없다(검증 기간 허용 목록 밖). 없으면 허용 */
  connectAllowed?: boolean
  calendars: GoogleCalendarSummary[]
  tasks?: ScheduleGoogleTasksState
}

/** 출처별 조회 결과. 한 출처가 실패해도 나머지는 그대로 온다. */
export type ScheduleSourceStatus = {
  google: string
  google_task: string
  onefc_todo: string
  crm: string
}

export type ScheduleEventsResponse = {
  from: string
  to: string
  sources: ScheduleFilterKey[]
  google: ScheduleGoogleState
  sourceStatus: ScheduleSourceStatus
  events: ScheduleEvent[]
  tasks: ScheduleTask[]
}

export const SCHEDULE_FILTER_KEYS: ScheduleFilterKey[] = ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age']

export const SCHEDULE_FILTER_LABEL: Record<ScheduleFilterKey, string> = {
  google: 'Google 일정',
  google_task: 'Google 할 일',
  onefc_todo: 'ONE FC 할 일',
  customer_alert: '알림일',
  car_expiry: '자동차 만기',
  insurance_age: '상령일',
}

export const EMPTY_GOOGLE_TASKS_STATE: ScheduleGoogleTasksState = { status: 'unconfigured', needsReconsent: false, taskLists: [] }

export const EMPTY_SOURCE_STATUS: ScheduleSourceStatus = { google: 'skipped', google_task: 'skipped', onefc_todo: 'skipped', crm: 'skipped' }

export function scheduleFilterKeyOf(event: Pick<ScheduleEvent, 'source' | 'type'>): ScheduleFilterKey {
  return event.source === 'google' ? 'google' : (event.type as ScheduleFilterKey)
}

export const EMPTY_GOOGLE_STATE: ScheduleGoogleState = {
  configured: false,
  connected: false,
  status: 'unconfigured',
  calendars: [],
  tasks: EMPTY_GOOGLE_TASKS_STATE,
}

function readGoogleTasksState(raw: unknown): ScheduleGoogleTasksState {
  const body = raw && typeof raw === 'object' ? (raw as Partial<ScheduleGoogleTasksState>) : {}
  return {
    status: (body.status ?? 'unconfigured') as ScheduleGoogleTasksStatus,
    needsReconsent: Boolean(body.needsReconsent),
    taskLists: Array.isArray(body.taskLists) ? body.taskLists : [],
  }
}

function readSourceStatus(raw: unknown): ScheduleSourceStatus {
  const body = raw && typeof raw === 'object' ? (raw as Partial<ScheduleSourceStatus>) : {}
  return {
    google: String(body.google ?? 'skipped'),
    google_task: String(body.google_task ?? 'skipped'),
    onefc_todo: String(body.onefc_todo ?? 'skipped'),
    crm: String(body.crm ?? 'skipped'),
  }
}

/**
 * `apiRequest` 는 `{ success, data }` 봉투를 풀 수도 있다. 둘 다 읽는다.
 */
export function readScheduleEventsResponse(payload: unknown): ScheduleEventsResponse {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const data = (Array.isArray(body.events) ? body : (body.data && typeof body.data === 'object' ? body.data : {})) as Partial<ScheduleEventsResponse>
  const google = data.google && typeof data.google === 'object' ? data.google : EMPTY_GOOGLE_STATE
  return {
    from: String(data.from ?? ''),
    to: String(data.to ?? ''),
    sources: Array.isArray(data.sources) ? data.sources : [],
    google: {
      configured: Boolean(google.configured),
      connected: Boolean(google.connected),
      status: (google.status ?? 'unconfigured') as ScheduleGoogleStatus,
      ...(google.connectAllowed === false ? { connectAllowed: false } : {}),
      calendars: Array.isArray(google.calendars) ? google.calendars : [],
      tasks: readGoogleTasksState(google.tasks),
    },
    sourceStatus: readSourceStatus(data.sourceStatus),
    events: Array.isArray(data.events) ? data.events : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  }
}

export async function fetchScheduleEvents(
  token: string,
  query: { from: string; to: string; sources: ScheduleFilterKey[]; calendarIds?: string[]; taskListIds?: string[] },
): Promise<ScheduleEventsResponse> {
  const params = new URLSearchParams()
  params.set('from', query.from)
  params.set('to', query.to)
  params.set('sources', query.sources.join(','))
  if (query.calendarIds && query.calendarIds.length > 0) {
    params.set('calendarIds', query.calendarIds.join(','))
  }
  if (query.taskListIds && query.taskListIds.length > 0) {
    params.set('taskListIds', query.taskListIds.join(','))
  }
  const raw = await apiRequest<unknown>(`/api/schedule/events?${params.toString()}`, { token })
  return readScheduleEventsResponse(raw)
}
