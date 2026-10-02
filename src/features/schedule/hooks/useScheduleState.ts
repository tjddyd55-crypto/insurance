import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { updateCustomerSpecialDate } from '../../customers/api/customerSpecialDatesApi'
import { buildCustomerWorkspacePath, buildExternalCustomerNavigateTarget } from '../../customers/utils/customerRoutePaths'
import {
  EMPTY_GOOGLE_STATE,
  fetchScheduleEvents,
  SCHEDULE_FILTER_KEYS,
  scheduleFilterKeyOf,
  type ScheduleEvent,
  type ScheduleFilterKey,
  type ScheduleGoogleState,
} from '../api/scheduleApi'
import {
  scheduleViewFromParam,
  seoulToday,
  shiftAnchor,
  viewQueryRange,
  type ScheduleView,
} from '../domain/scheduleRange'

export type ScheduleViewProps = {
  token: string
  view: ScheduleView
  anchor: string
  today: string
  sources: ScheduleFilterKey[]
  calendarIds: string[]
  events: ScheduleEvent[]
  google: ScheduleGoogleState
  loading: boolean
  error: string
  selectedDate: string
  detail: ScheduleEvent | null
  editing: ScheduleEvent | null
  editTitle: string
  editDate: string
  editDirty: boolean
  onSelectView: (view: ScheduleView) => void
  onShift: (delta: number) => void
  onToday: () => void
  onSelectDate: (date: string) => void
  onOpenDay: (date: string) => void
  onToggleSource: (source: ScheduleFilterKey | 'all') => void
  onToggleCalendar: (calendarId: string) => void
  onOpenEvent: (event: ScheduleEvent) => void
  onCloseDetail: () => void
  onOpenCustomer: (event: ScheduleEvent) => void
  onOpenIntegrations: () => void
  onEditTitle: (value: string) => void
  onEditDate: (value: string) => void
  onCloseEdit: () => void
  onSaveEdit: () => void
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

type Owned<T> = { owner: string; value: T }

type FetchResult = {
  key: string
  owner: string
  events: ScheduleEvent[]
  google: ScheduleGoogleState
  error: string
}

const EMPTY_EVENTS: ScheduleEvent[] = []
const EMPTY_RESULT: FetchResult = { key: '', owner: '', events: EMPTY_EVENTS, google: EMPTY_GOOGLE_STATE, error: '' }

export function parseScheduleSources(raw: string | null): ScheduleFilterKey[] {
  if (!raw || raw === 'all') {
    return SCHEDULE_FILTER_KEYS
  }
  const picked = raw.split(',').filter((item): item is ScheduleFilterKey => SCHEDULE_FILTER_KEYS.includes(item as ScheduleFilterKey))
  return picked.length > 0 ? picked : SCHEDULE_FILTER_KEYS
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
  const sourcesKey = searchParams.get('sources') ?? ''
  const sources = useMemo(() => parseScheduleSources(sourcesKey), [sourcesKey])
  const calendarsKey = searchParams.get('calendars') ?? ''
  const calendarIds = useMemo(() => calendarsKey.split(',').map((id) => id.trim()).filter(Boolean), [calendarsKey])
  const [reloadNonce, setReloadNonce] = useState(0)
  // 조회 결과·열린 상세는 받은 사용자(owner)를 같이 둔다. 로그아웃 → 다른 계정이면 즉시 화면에서 빠진다.
  const [result, setResult] = useState<FetchResult>(EMPTY_RESULT)
  const [actionError, setActionError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [detailState, setDetailState] = useState<Owned<ScheduleEvent> | null>(null)
  const [editingState, setEditingState] = useState<Owned<ScheduleEvent> | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editBaselineTitle, setEditBaselineTitle] = useState('')
  const [editBaselineDate, setEditBaselineDate] = useState('')

  const hasToken = Boolean(token?.trim())
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
    void fetchScheduleEvents(token, { from: range.start, to: range.end, sources: SCHEDULE_FILTER_KEYS, calendarIds: ids })
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, owner: userKey, events: data.events, google: data.google, error: '' })
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setResult({ key: requestKey, owner: userKey, events: [], google: EMPTY_GOOGLE_STATE, error: messageOf(loadError) })
      })
    return () => {
      cancelled = true
    }
  }, [anchor, calendarsKey, requestKey, token, userKey, view])

  const sameOwner = hasToken && result.owner === userKey
  const events = sameOwner ? result.events : EMPTY_EVENTS
  const google = sameOwner ? result.google : EMPTY_GOOGLE_STATE
  const loading = hasToken && result.key !== requestKey
  const fetchError = result.key === requestKey ? result.error : ''
  const error = hasToken ? (actionError || fetchError) : '로그인이 필요합니다.'
  const detail = detailState && detailState.owner === userKey ? detailState.value : null
  const editing = editingState && editingState.owner === userKey ? editingState.value : null

  // 출처 필터는 받아 둔 기간 데이터에서만 거른다(필터 변경마다 다시 부르지 않음).
  const visibleEvents = useMemo(
    () => events.filter((event) => sources.includes(scheduleFilterKeyOf(event))),
    [events, sources],
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
    token: token ?? '',
    view,
    anchor,
    today,
    sources,
    calendarIds,
    events: visibleEvents,
    google,
    loading,
    error,
    selectedDate,
    detail,
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
      const next = toggleScheduleSource(sources, source)
      replaceQuery({ sources: next.length === SCHEDULE_FILTER_KEYS.length ? '' : next.join(',') })
    },
    onToggleCalendar: (calendarId) => {
      const current = calendarIds.length > 0
        ? calendarIds
        : google.calendars.filter((calendar) => calendar.defaultVisible).map((calendar) => calendar.id)
      const next = current.includes(calendarId)
        ? current.filter((id) => id !== calendarId)
        : [...current, calendarId]
      // 모두 끄면 기본 표시로 돌아간다(빈 목록 = 서버 기본값).
      replaceQuery({ calendars: next.join(',') })
    },
    onOpenEvent,
    onCloseDetail: () => setDetailState(null),
    onOpenCustomer,
    onOpenIntegrations: () => navigate('/service-integrations'),
    onEditTitle: setEditTitle,
    onEditDate: setEditDate,
    onCloseEdit: () => setEditingState(null),
    onSaveEdit,
  }
}
