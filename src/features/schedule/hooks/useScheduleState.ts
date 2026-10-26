import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { updateCustomerSpecialDate } from '../../customers/api/customerSpecialDatesApi'
import { buildCustomerWorkspacePath, buildExternalCustomerNavigateTarget } from '../../customers/utils/customerRoutePaths'
import {
  EMPTY_GOOGLE_STATE,
  EMPTY_SOURCE_STATUS,
  fetchScheduleEvents,
  SCHEDULE_FILTER_KEYS,
  scheduleFilterKeyOf,
  type ScheduleEvent,
  type ScheduleFilterKey,
  type ScheduleGoogleState,
  type ScheduleSourceStatus,
  type ScheduleTask,
} from '../api/scheduleApi'
import { filterScheduleTasks } from '../domain/scheduleTasks'
import {
  getScheduleViewPrefs,
  loadScheduleViewPrefs,
  queueScheduleViewPrefs,
  subscribeScheduleViewPrefs,
} from '../domain/scheduleViewPrefs'
import {
  scheduleViewFromParam,
  seoulToday,
  shiftAnchor,
  viewQueryRange,
  type ScheduleView,
} from '../domain/scheduleRange'

export type ScheduleViewProps = {
  token: string
  /** 로그인 사용자 id (개인 표시 설정 키). */
  userKey?: string
  view: ScheduleView
  anchor: string
  today: string
  sources: ScheduleFilterKey[]
  calendarIds: string[]
  events: ScheduleEvent[]
  /** 출처 필터·완료 포함이 반영된 할 일(Google Tasks · ONE FC 할 일) */
  tasks: ScheduleTask[]
  includeCompleted: boolean
  /** PC 목록 보기: 다른 달의 지난(미완료) 할 일 전체도 보기. 기본은 조회 월만. */
  includeOverdue: boolean
  onToggleOverdue: () => void
  google: ScheduleGoogleState
  sourceStatus: ScheduleSourceStatus
  loading: boolean
  error: string
  /** 마지막 갱신 시각(ISO). 자동·수동 조회 모두 갱신 */
  lastRefreshedAt: string
  /** 수동 새로고침 진행 중 */
  refreshing: boolean
  refreshMessage: { kind: 'success' | 'error'; text: string } | null
  onRefresh: () => void
  /** 저장 후 재조회(서버가 그 사용자 Google 캐시를 이미 지웠다). 수동 새로고침 제한과 무관. */
  onReload: () => void
  selectedDate: string
  detail: ScheduleEvent | null
  taskDetail: ScheduleTask | null
  /** 일정 관리에서 연 ONE FC 할 일(할 일 상세 모달) */
  todoEditing: ScheduleTask | null
  gaId: number | null
  onCloseTodoEditing: () => void
  onTodoMissing: (message: string) => void
  editing: ScheduleEvent | null
  editTitle: string
  editDate: string
  editDirty: boolean
  onSelectView: (view: ScheduleView) => void
  onShift: (delta: number) => void
  onToday: () => void
  onSelectDate: (date: string) => void
  onOpenDay: (date: string) => void
  onToggleSource: (source: ScheduleFilterKey | 'all' | ScheduleFilterGroup) => void
  onToggleCalendar: (calendarId: string) => void
  onOpenEvent: (event: ScheduleEvent) => void
  onCloseDetail: () => void
  onToggleCompleted: () => void
  onOpenTask: (task: ScheduleTask) => void
  onCloseTaskDetail: () => void
  onOpenTodos: () => void
  onOpenCustomer: (event: ScheduleEvent) => void
  onOpenIntegrations: () => void
  onEditTitle: (value: string) => void
  onEditDate: (value: string) => void
  onCloseEdit: () => void
  onSaveEdit: () => void
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
/** focus·visibility 자동 재조회 최소 간격 */
export const AUTO_REFETCH_MIN_MS = 15 * 1000

type Owned<T> = { owner: string; value: T }

type FetchResult = {
  key: string
  owner: string
  /** 마지막으로 성공한 조회 시각(ISO). 실패해도 이전 값을 유지한다. */
  fetchedAt: string
  events: ScheduleEvent[]
  tasks: ScheduleTask[]
  google: ScheduleGoogleState
  sourceStatus: ScheduleSourceStatus
  error: string
}

const EMPTY_EVENTS: ScheduleEvent[] = []
const EMPTY_TASKS: ScheduleTask[] = []
const EMPTY_RESULT: FetchResult = { fetchedAt: '',
  key: '',
  owner: '',
  events: EMPTY_EVENTS,
  tasks: EMPTY_TASKS,
  google: EMPTY_GOOGLE_STATE,
  sourceStatus: EMPTY_SOURCE_STATUS,
  error: '',
}

export function parseScheduleSources(raw: string | null): ScheduleFilterKey[] {
  if (!raw || raw === 'all') {
    return SCHEDULE_FILTER_KEYS
  }
  if (raw === 'none') {
    return []
  }
  const picked = raw.split(',').filter((item): item is ScheduleFilterKey => SCHEDULE_FILTER_KEYS.includes(item as ScheduleFilterKey))
  return picked.length > 0 ? picked : SCHEDULE_FILTER_KEYS
}

/** 화면 필터 묶음: 일정(Google 일정) · 할 일(ONE FC 할 일 + Google 할 일). 나머지는 출처 하나씩. */
export type ScheduleFilterGroup = 'event' | 'todo' | 'customer_alert' | 'car_expiry' | 'insurance_age'

export const SCHEDULE_FILTER_GROUPS: Array<{ id: ScheduleFilterGroup; label: string; keys: ScheduleFilterKey[] }> = [
  { id: 'event', label: '일정', keys: ['google'] },
  { id: 'todo', label: '할 일', keys: ['onefc_todo', 'google_task'] },
  { id: 'customer_alert', label: '알림일', keys: ['customer_alert'] },
  { id: 'car_expiry', label: '자동차 만기', keys: ['car_expiry'] },
  { id: 'insurance_age', label: '상령일', keys: ['insurance_age'] },
]

export function isScheduleFilterGroupOn(current: ScheduleFilterKey[], group: ScheduleFilterGroup): boolean {
  const keys = SCHEDULE_FILTER_GROUPS.find((item) => item.id === group)?.keys ?? []
  return keys.length > 0 && keys.every((key) => current.includes(key))
}

/** 묶음 하나를 켜고 끈다(서로 독립). 순서는 SCHEDULE_FILTER_KEYS 기준. */
export function toggleScheduleFilterGroup(current: ScheduleFilterKey[], group: ScheduleFilterGroup): ScheduleFilterKey[] {
  const keys = SCHEDULE_FILTER_GROUPS.find((item) => item.id === group)?.keys ?? []
  const on = isScheduleFilterGroupOn(current, group)
  const next = on ? current.filter((key) => !keys.includes(key)) : [...current, ...keys]
  return SCHEDULE_FILTER_KEYS.filter((key) => next.includes(key))
}

function isFilterGroup(value: string): value is ScheduleFilterGroup {
  return SCHEDULE_FILTER_GROUPS.some((item) => item.id === value)
}

/** 전체 → 하나만, 하나씩 켜고 끄기, 모두 꺼지거나 모두 켜지면 전체. */
export function toggleScheduleSource(current: ScheduleFilterKey[], source: ScheduleFilterKey | 'all'): ScheduleFilterKey[] {
  if (source === 'all') {
    return SCHEDULE_FILTER_KEYS
  }
  const hasAll = current.length === SCHEDULE_FILTER_KEYS.length
  const next = hasAll
    ? [source]
    : current.includes(source)
      ? current.filter((item) => item !== source)
      : [...current, source]
  return next.length === 0 || next.length === SCHEDULE_FILTER_KEYS.length ? SCHEDULE_FILTER_KEYS : next
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : '일정을 불러오지 못했습니다.'
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
}

export function useScheduleState(): ScheduleViewProps {
  const { token, user } = useAuth()
  const userKey = user?.id ? String(user.id) : ''
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = scheduleViewFromParam(params.view)
  const today = seoulToday()
  const anchor = YMD.test(searchParams.get('date') ?? '') ? String(searchParams.get('date')) : today
  // 표시 설정 우선순위(키별): URL 쿼리 > 사용자 저장값(서버, 로드 전엔 사용자별 캐시) > 기본값.
  const savedPrefs = useSyncExternalStore(
    subscribeScheduleViewPrefs,
    () => getScheduleViewPrefs(userKey),
    () => getScheduleViewPrefs(userKey),
  )
  const sourcesKey = searchParams.has('sources')
    ? searchParams.get('sources') ?? ''
    : savedPrefs.sources
      ? (savedPrefs.sources.length === 0 ? 'none' : savedPrefs.sources.join(','))
      : ''
  const sources = useMemo(() => parseScheduleSources(sourcesKey), [sourcesKey])
  const requestedCalendarsKey = searchParams.has('calendars')
    ? searchParams.get('calendars') ?? ''
    : (savedPrefs.googleCalendarIds ?? []).join(',')
  const includeCompleted = searchParams.has('done') ? searchParams.get('done') === '1' : savedPrefs.includeCompleted === true
  const includeOverdue = searchParams.has('overdue') ? searchParams.get('overdue') === '1' : savedPrefs.includeOverdue === true
  const [reloadNonce, setReloadNonce] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const manualRefreshRef = useRef(false)
  const lastFetchAtRef = useRef(0)
  // 조회 결과·열린 상세는 받은 사용자(owner)를 같이 둔다. 로그아웃 → 다른 계정이면 즉시 화면에서 빠진다.
  const [result, setResult] = useState<FetchResult>(EMPTY_RESULT)
  const [actionError, setActionError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [detailState, setDetailState] = useState<Owned<ScheduleEvent> | null>(null)
  const [taskDetailState, setTaskDetailState] = useState<Owned<ScheduleTask> | null>(null)
  const [todoEditingState, setTodoEditingState] = useState<Owned<ScheduleTask> | null>(null)
  const [editingState, setEditingState] = useState<Owned<ScheduleEvent> | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editBaselineTitle, setEditBaselineTitle] = useState('')
  const [editBaselineDate, setEditBaselineDate] = useState('')

  const hasToken = Boolean(token?.trim())
  // 저장/요청된 Google 캘린더 중 실제 존재하는 것만. 하나도 없으면 기본 표시(빈 목록).
  const knownCalendars = hasToken && result.owner === userKey && result.google.status === 'connected' ? result.google.calendars : null
  const calendarsKey = useMemo(() => {
    const ids = requestedCalendarsKey.split(',').map((id) => id.trim()).filter(Boolean)
    if (!knownCalendars || knownCalendars.length === 0) return ids.join(',')
    return ids.filter((id) => knownCalendars.some((calendar) => calendar.id === id)).join(',')
  }, [knownCalendars, requestedCalendarsKey])
  const calendarIds = useMemo(() => calendarsKey.split(',').map((id) => id.trim()).filter(Boolean), [calendarsKey])

  // 로그인 사용자 저장값 로드(읽기만 — 기본값으로 덮어쓰거나 저장하지 않음). 실패 시 캐시/기본값 유지.
  useEffect(() => {
    if (!userKey || !token?.trim()) return
    loadScheduleViewPrefs(userKey, token).catch(() => {})
  }, [token, userKey])

  /** 사용자 토글만 저장한다(복원 경로에서는 호출 금지 → 저장 루프 없음). */
  const savePrefs = useCallback((patch: Parameters<typeof queueScheduleViewPrefs>[2]) => {
    queueScheduleViewPrefs(userKey, token, patch)
  }, [token, userKey])
  const requestKey = `${userKey}|${view}|${anchor}|${calendarsKey}|${reloadNonce}`

  const replaceQuery = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // 화면(월·주·일)과 기간이 바뀔 때만 조회. polling 없음. 늦게 온 이전 응답은 버린다.
  useEffect(() => {
    if (!token?.trim()) {
      return
    }
    const range = viewQueryRange(view, anchor)
    const ids = calendarsKey.split(',').map((id) => id.trim()).filter(Boolean)
    let cancelled = false
    const manual = manualRefreshRef.current
    manualRefreshRef.current = false
    void fetchScheduleEvents(token, { from: range.start, to: range.end, sources: SCHEDULE_FILTER_KEYS, calendarIds: ids, refresh: manual })
      .then((data) => {
        if (!cancelled) {
          lastFetchAtRef.current = Date.now()
          if (manual) {
            setRefreshing(false)
            setRefreshMessage({ kind: 'success', text: '일정을 새로 불러왔습니다.' })
          }
          setResult({
            key: requestKey,
            owner: userKey,
            fetchedAt: data.fetchedAt || new Date().toISOString(),
            events: data.events ?? EMPTY_EVENTS,
            tasks: data.tasks ?? EMPTY_TASKS,
            google: data.google,
            sourceStatus: data.sourceStatus ?? EMPTY_SOURCE_STATUS,
            error: '',
          })
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        if (manual) {
          // 수동 새로고침 실패(예: 10초 제한)는 보던 일정을 그대로 두고 안내만 한다.
          setRefreshing(false)
          setRefreshMessage({ kind: 'error', text: messageOf(loadError) })
          setResult((previous) => (previous.owner === userKey ? { ...previous, key: requestKey, error: '' } : { ...EMPTY_RESULT, key: requestKey, owner: userKey, error: messageOf(loadError) }))
          return
        }
        setResult((previous) => ({ ...EMPTY_RESULT, fetchedAt: previous.owner === userKey ? previous.fetchedAt : '', key: requestKey, owner: userKey, error: messageOf(loadError) }))
      })
    return () => {
      cancelled = true
      if (manual) setRefreshing(false)
    }
  }, [anchor, calendarsKey, requestKey, token, userKey, view])

  // 창 focus·탭 다시 보임(데스크톱 앱 포함) 때 자동 재조회. 15초 안에 받은 결과가 있으면 건너뛴다(서버 캐시 60초).
  useEffect(() => {
    if (!hasToken) return
    const refetch = () => {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - lastFetchAtRef.current < AUTO_REFETCH_MIN_MS) return
      setReloadNonce((current) => current + 1)
    }
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', refetch)
    return () => {
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', refetch)
    }
  }, [hasToken])

  useEffect(() => {
    if (!refreshMessage) return
    const timer = window.setTimeout(() => setRefreshMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [refreshMessage])

  const onRefresh = useCallback(() => {
    if (!hasToken || refreshing) return
    manualRefreshRef.current = true
    setRefreshing(true)
    setRefreshMessage(null)
    setReloadNonce((current) => current + 1)
  }, [hasToken, refreshing])

  const sameOwner = hasToken && result.owner === userKey
  const events = sameOwner ? result.events : EMPTY_EVENTS
  const tasks = sameOwner ? result.tasks : EMPTY_TASKS
  const google = sameOwner ? result.google : EMPTY_GOOGLE_STATE
  const sourceStatus = sameOwner ? result.sourceStatus : EMPTY_SOURCE_STATUS
  const loading = hasToken && result.key !== requestKey
  const fetchError = result.key === requestKey ? result.error : ''
  const error = hasToken ? (actionError || fetchError) : '로그인이 필요합니다.'
  const detail = detailState && detailState.owner === userKey ? detailState.value : null
  const taskDetail = taskDetailState && taskDetailState.owner === userKey ? taskDetailState.value : null
  const editing = editingState && editingState.owner === userKey ? editingState.value : null
  const todoEditing = todoEditingState && todoEditingState.owner === userKey ? todoEditingState.value : null

  // 출처 필터는 받아 둔 기간 데이터에서만 거른다(필터 변경마다 다시 부르지 않음).
  const visibleEvents = useMemo(
    () => events.filter((event) => sources.includes(scheduleFilterKeyOf(event))),
    [events, sources],
  )
  const visibleTasks = useMemo(
    () => filterScheduleTasks(tasks, sources, includeCompleted),
    [includeCompleted, sources, tasks],
  )

  const onOpenCustomer = useCallback((event: ScheduleEvent) => {
    if (!event.customerId) {
      return
    }
    setDetailState(null)
    setEditingState(null)
    navigate(buildExternalCustomerNavigateTarget({ customerId: event.customerId, isMobile: isMobileViewport() }))
  }, [navigate])

  const onOpenEvent = useCallback((event: ScheduleEvent) => {
    if (event.source === 'google') {
      setDetailState({ owner: userKey, value: event })
      return
    }
    if (event.type === 'customer_alert' && event.customerId && event.sourceId && event.sourceTitle) {
      const title = event.sourceTitle
      const date = event.sourceDate || event.startAt.slice(0, 10)
      setEditingState({ owner: userKey, value: event })
      setActionError('')
      setEditTitle(title)
      setEditDate(date)
      setEditBaselineTitle(title)
      setEditBaselineDate(date)
      return
    }
    if (!event.customerId) {
      return
    }
    if (event.type === 'car_expiry') {
      navigate(buildCustomerWorkspacePath({ customerId: event.customerId, tab: 'auto-form' }))
      return
    }
    onOpenCustomer(event)
  }, [navigate, onOpenCustomer, userKey])

  const onSaveEdit = useCallback(() => {
    if (!token?.trim() || !editing?.customerId || editing.type !== 'customer_alert') {
      return
    }
    const title = editTitle.trim()
    if (!title || !editDate) {
      setActionError('내용과 날짜를 입력해 주세요.')
      return
    }
    void updateCustomerSpecialDate(token, editing.customerId, Number(editing.sourceId), {
      title,
      dateValue: editDate,
    }).then(() => {
      setEditingState(null)
      setActionError('')
      setReloadNonce((current) => current + 1)
    }).catch((saveError: unknown) => setActionError(messageOf(saveError)))
  }, [editDate, editTitle, editing, token])

  const goToView = useCallback((next: ScheduleView, date?: string) => {
    const query = new URLSearchParams(searchParams)
    if (date) query.set('date', date)
    const pathname = next === 'month' ? '/schedule' : `/schedule/${next}`
    navigate({ pathname, search: query.toString() })
  }, [navigate, searchParams])

  return {
    userKey,
    token: token ?? '',
    view,
    anchor,
    today,
    sources,
    calendarIds,
    events: visibleEvents,
    tasks: visibleTasks,
    includeCompleted,
    includeOverdue,
    onToggleOverdue: () => {
      savePrefs({ includeOverdue: !includeOverdue })
      replaceQuery({ overdue: includeOverdue ? '' : '1' })
    },
    google,
    sourceStatus,
    loading,
    error,
    lastRefreshedAt: sameOwner ? result.fetchedAt : '',
    refreshing,
    refreshMessage,
    onRefresh,
    onReload: () => setReloadNonce((current) => current + 1),
    selectedDate,
    detail,
    taskDetail,
    todoEditing,
    gaId: user?.gaId != null && Number.isFinite(Number(user.gaId)) ? Number(user.gaId) : null,
    onCloseTodoEditing: () => setTodoEditingState(null),
    onTodoMissing: (message) => {
      setTodoEditingState(null)
      setActionError(message)
      setReloadNonce((current) => current + 1)
    },
    editing,
    editTitle,
    editDate,
    editDirty: editing != null && (editTitle !== editBaselineTitle || editDate !== editBaselineDate),
    onSelectView: (next) => goToView(next),
    onShift: (delta) => {
      setSelectedDate('')
      replaceQuery({ date: shiftAnchor(view, anchor, delta) })
    },
    onToday: () => {
      setSelectedDate(view === 'month' ? today : '')
      replaceQuery({ date: today })
    },
    onSelectDate: (date) => setSelectedDate((current) => (current === date ? '' : date)),
    onOpenDay: (date) => goToView('day', date),
    onToggleSource: (source) => {
      const next = source !== 'all' && isFilterGroup(source)
        ? toggleScheduleFilterGroup(sources, source)
        : toggleScheduleSource(sources, source)
      savePrefs({ sources: next })
      replaceQuery({ sources: next.length === SCHEDULE_FILTER_KEYS.length ? '' : next.length === 0 ? 'none' : next.join(',') })
    },
    onToggleCalendar: (calendarId) => {
      const current = calendarIds.length > 0
        ? calendarIds
        : google.calendars.filter((calendar) => calendar.defaultVisible).map((calendar) => calendar.id)
      const next = current.includes(calendarId)
        ? current.filter((id) => id !== calendarId)
        : [...current, calendarId]
      // 모두 끄면 기본 표시로 돌아간다(빈 목록 = 서버 기본값).
      savePrefs({ googleCalendarIds: next.length > 0 ? next : null })
      replaceQuery({ calendars: next.join(',') })
    },
    onOpenEvent,
    onCloseDetail: () => setDetailState(null),
    onToggleCompleted: () => {
      savePrefs({ includeCompleted: !includeCompleted })
      replaceQuery({ done: includeCompleted ? '' : '1' })
    },
    // ONE FC 할 일 → 할 일 목록과 같은 상세 모달을 그 자리에서. Google 할 일 → 기존 상세(쓰기 버튼은 기존 정책).
    onOpenTask: (task) => {
      if (task.source === 'onefc_todo') {
        setActionError('')
        setTodoEditingState({ owner: userKey, value: task })
        return
      }
      setTaskDetailState({ owner: userKey, value: task })
    },
    onCloseTaskDetail: () => setTaskDetailState(null),
    onOpenTodos: () => {
      setTaskDetailState(null)
      navigate('/todos')
    },
    onOpenCustomer,
    onOpenIntegrations: () => navigate('/service-integrations'),
    onEditTitle: setEditTitle,
    onEditDate: setEditDate,
    onCloseEdit: () => setEditingState(null),
    onSaveEdit,
  }
}
