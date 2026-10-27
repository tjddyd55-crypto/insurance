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
  /** t307: ONE FC 에서 수정·삭제 가능한 Google 일정(쓰기 권한·기능 플래그는 google.write 로 따로 본다) */
  writable?: boolean
  readOnlyReason?: string
  /** ONE FC calendar_items 일정. 필터 키는 google 과 같고, 수정은 /api/schedules 다. */
  origin?: 'onefc'
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
  /** t307 쓰기 상태. enabled=false 면 쓰기 UI 를 숨긴다. */
  write?: ScheduleGoogleWriteState
}

export type ScheduleGoogleWriteState = {
  enabled: boolean
  calendarWritable: boolean
  tasksWritable: boolean
  needsWriteConsent: boolean
}

export const EMPTY_GOOGLE_WRITE_STATE: ScheduleGoogleWriteState = { enabled: false, calendarWritable: false, tasksWritable: false, needsWriteConsent: false }

function readGoogleWriteState(raw: unknown): ScheduleGoogleWriteState {
  const body = raw && typeof raw === 'object' ? (raw as Partial<ScheduleGoogleWriteState>) : {}
  return {
    enabled: body.enabled === true,
    calendarWritable: body.calendarWritable === true,
    tasksWritable: body.tasksWritable === true,
    needsWriteConsent: body.needsWriteConsent === true,
  }
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
  /** 서버가 응답을 만든 시각(ISO). 없으면 빈 문자열. */
  fetchedAt: string
  /** refresh=1 로 Google 캐시를 건너뛰었는가 */
  cacheBypassed: boolean
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
      write: readGoogleWriteState((google as { write?: unknown }).write),
    },
    sourceStatus: readSourceStatus(data.sourceStatus),
    events: Array.isArray(data.events) ? data.events : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    fetchedAt: typeof data.fetchedAt === 'string' ? data.fetchedAt : '',
    cacheBypassed: data.cacheBypassed === true,
  }
}

export async function fetchScheduleEvents(
  token: string,
  query: { from: string; to: string; sources: ScheduleFilterKey[]; calendarIds?: string[]; refresh?: boolean },
): Promise<ScheduleEventsResponse> {
  const params = new URLSearchParams()
  params.set('from', query.from)
  params.set('to', query.to)
  params.set('sources', query.sources.join(','))
  if (query.calendarIds && query.calendarIds.length > 0) {
    params.set('calendarIds', query.calendarIds.join(','))
  }
  if (query.refresh) {
    params.set('refresh', '1')
  }
  const raw = await apiRequest<unknown>(`/api/schedule/events?${params.toString()}`, { token })
  return readScheduleEventsResponse(raw)
}

/** 마지막 갱신 표시(KST). 오늘이면 HH:mm, 아니면 M/D HH:mm. */
export function formatScheduleRefreshedAt(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  if (!iso || Number.isNaN(at.getTime())) return ''
  const ymd = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  if (ymd(at) === ymd(now)) return hm
  const [, month, day] = ymd(at).split('-')
  return `${Number(month)}/${Number(day)} ${hm}`
}

// ---------------- t307 Google 쓰기 ----------------

const WRITE_BASE = '/api/service-integrations/google/write'

/** 중복 클릭·재시도용 요청 id(32 hex). 같은 저장 시도에는 같은 값을 다시 쓴다. */
export function newGoogleRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type GoogleWriteTargets = ScheduleGoogleWriteState & {
  accountEmail: string
  calendars: GoogleCalendarSummary[]
  taskLists: Array<{ id: string; name: string }>
}

function unwrap<T>(raw: unknown): T {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return ('data' in body && body.data && typeof body.data === 'object' ? body.data : body) as T
}

export async function fetchGoogleWriteTargets(token: string): Promise<GoogleWriteTargets> {
  const data = unwrap<Partial<GoogleWriteTargets>>(await apiRequest<unknown>(`${WRITE_BASE}/targets`, { token }))
  return {
    ...readGoogleWriteState(data),
    accountEmail: String(data.accountEmail ?? ''),
    calendars: Array.isArray(data.calendars) ? data.calendars : [],
    taskLists: Array.isArray(data.taskLists) ? data.taskLists : [],
  }
}

/** 쓰기 권한 증분 동의 시작. 웹은 같은 창 이동, 데스크톱 앱은 시스템 브라우저. */
export async function startGoogleWriteConsent(token: string, desktop: boolean): Promise<{ url: string; action: string }> {
  const data = unwrap<{ url?: string; action?: string }>(await apiRequest<unknown>(`${WRITE_BASE}/connect`, {
    token,
    method: 'POST',
    body: JSON.stringify(desktop ? { client: 'desktop' } : {}),
  }))
  return { url: String(data.url ?? ''), action: String(data.action ?? 'redirect') }
}

export type GoogleEventInput = {
  calendarId: string
  title: string
  description: string
  date: string
  endDate: string
  allDay: boolean
  /** 종일(allDay true)이면 null. 시간 일정은 HH:mm. */
  startTime: string | null
  endTime: string | null
}

export async function createGoogleEvent(token: string, input: GoogleEventInput & { requestId: string }) {
  return unwrap<{ event: ScheduleEvent; duplicate?: boolean }>(await apiRequest<unknown>(`${WRITE_BASE}/events`, { token, method: 'POST', body: JSON.stringify(input) }))
}

export async function updateGoogleEvent(token: string, input: GoogleEventInput & { eventId: string }) {
  return unwrap<{ event: ScheduleEvent }>(await apiRequest<unknown>(`${WRITE_BASE}/events`, { token, method: 'PATCH', body: JSON.stringify(input) }))
}

export async function deleteGoogleEvent(token: string, calendarId: string, eventId: string) {
  return unwrap<{ deleted: boolean }>(await apiRequest<unknown>(`${WRITE_BASE}/events`, { token, method: 'DELETE', body: JSON.stringify({ calendarId, eventId }) }))
}

export async function createOnefcSchedule(token: string, input: GoogleEventInput & { requestId?: string }) {
  return unwrap<{ event: ScheduleEvent; duplicate?: boolean }>(await apiRequest<unknown>('/api/schedules', { token, method: 'POST', body: JSON.stringify(input) }))
}

export async function updateOnefcSchedule(token: string, id: string, input: GoogleEventInput) {
  return unwrap<{ event: ScheduleEvent }>(await apiRequest<unknown>(`/api/schedules/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: JSON.stringify(input) }))
}

export async function deleteOnefcSchedule(token: string, id: string) {
  return unwrap<{ deleted: boolean }>(await apiRequest<unknown>(`/api/schedules/${encodeURIComponent(id)}`, { token, method: 'DELETE' }))
}

export type GoogleTaskInput = { taskListId: string; title: string; notes: string; dueDate: string | null }

export async function createGoogleTask(token: string, input: GoogleTaskInput & { requestId: string }) {
  return unwrap<{ task: ScheduleTask }>(await apiRequest<unknown>(`${WRITE_BASE}/tasks`, { token, method: 'POST', body: JSON.stringify(input) }))
}

export async function updateGoogleTask(
  token: string,
  input: { taskListId: string; taskId: string; title?: string; notes?: string; dueDate?: string | null; completed?: boolean },
) {
  return unwrap<{ task: ScheduleTask }>(await apiRequest<unknown>(`${WRITE_BASE}/tasks`, { token, method: 'PATCH', body: JSON.stringify(input) }))
}

export async function deleteGoogleTask(token: string, taskListId: string, taskId: string) {
  return unwrap<{ deleted: boolean }>(await apiRequest<unknown>(`${WRITE_BASE}/tasks`, { token, method: 'DELETE', body: JSON.stringify({ taskListId, taskId }) }))
}

/** Google 일정이 읽기 전용인 이유(화면 안내). */
export const GOOGLE_READ_ONLY_REASON: Record<string, string> = {
  calendar_read_only: '이 캘린더는 읽기 전용입니다.',
  recurring: '반복 일정은 Google Calendar에서 수정해 주세요.',
  attendees: '참석자가 있는 일정은 Google Calendar에서 수정해 주세요.',
  conference: '화상 회의가 연결된 일정은 Google Calendar에서 수정해 주세요.',
  not_organizer: '다른 사람이 만든 일정은 수정할 수 없습니다.',
  special_type: '이 유형의 일정은 Google Calendar에서 수정해 주세요.',
  locked: '잠긴 일정은 수정할 수 없습니다.',
}

/** 일정 화면 표시 설정(사용자별, 서버 SSOT). 없는 키 = 클라이언트 기본값. */
export type ScheduleViewPrefs = {
  sources?: ScheduleFilterKey[]
  includeCompleted?: boolean
  includeOverdue?: boolean
  googleCalendarIds?: string[] | null
  holidayMode?: 'kr' | 'none'
}

const VIEW_PREFS_PATH = '/api/me/schedule-view-prefs'

export async function fetchScheduleViewPrefs(token: string): Promise<ScheduleViewPrefs> {
  const raw = await apiRequest<{ prefs?: ScheduleViewPrefs }>(VIEW_PREFS_PATH, { token })
  return raw && typeof raw.prefs === 'object' && raw.prefs ? raw.prefs : {}
}

export async function saveScheduleViewPrefs(token: string, prefs: ScheduleViewPrefs): Promise<ScheduleViewPrefs> {
  const raw = await apiRequest<{ prefs?: ScheduleViewPrefs }>(VIEW_PREFS_PATH, { token, method: 'PATCH', body: JSON.stringify({ prefs }) })
  return raw && typeof raw.prefs === 'object' && raw.prefs ? raw.prefs : {}
}
