import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { updateCustomerSpecialDate } from '../../customers/api/customerSpecialDatesApi'
import { buildCustomerWorkspacePath } from '../../customers/utils/customerRoutePaths'
import { buildExternalCustomerNavigateTarget } from '../../customers/utils/customerRoutePaths'
import {
  fetchScheduleEvents,
  type ScheduleEvent,
  type ScheduleGoogleState,
  type ScheduleSource,
} from '../api/scheduleApi'
import {
  scheduleViewFromParam,
  seoulToday,
  shiftAnchor,
  viewQueryRange,
  type ScheduleView,
} from '../domain/scheduleRange'

const ALL_SOURCES: ScheduleSource[] = ['google', 'customer_alert', 'car_expiry', 'insurance_age', 'personal']

export type ScheduleViewProps = {
  token: string
  view: ScheduleView
  anchor: string
  sources: ScheduleSource[]
  events: ScheduleEvent[]
  google: ScheduleGoogleState
  loading: boolean
  error: string
  editing: ScheduleEvent | null
  editTitle: string
  editDate: string
  editDirty: boolean
  onSelectView: (view: ScheduleView) => void
  onShift: (delta: number) => void
  onSelectDate: (date: string) => void
  onToggleSource: (source: ScheduleSource | 'all') => void
  onOpenEvent: (event: ScheduleEvent) => void
  onOpenIntegrations: () => void
  onEditTitle: (value: string) => void
  onEditDate: (value: string) => void
  onCloseEdit: () => void
  onSaveEdit: () => void
}

function parseSources(raw: string | null): ScheduleSource[] {
  if (!raw || raw === 'all') {
    return ALL_SOURCES
  }
  const picked = raw.split(',').filter((item): item is ScheduleSource => ALL_SOURCES.includes(item as ScheduleSource))
  return picked.length > 0 ? picked : ALL_SOURCES
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : '일정을 불러오지 못했습니다.'
}

export function useScheduleState(): ScheduleViewProps {
  const { token } = useAuth()
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = scheduleViewFromParam(params.view)
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '')
    ? String(searchParams.get('date'))
    : seoulToday()
  const sourcesKey = searchParams.get('sources') ?? ''
  const sources = parseSources(sourcesKey)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [google, setGoogle] = useState<ScheduleGoogleState>({
    configured: false,
    connected: false,
    status: 'unconfigured',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ScheduleEvent | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editBaselineTitle, setEditBaselineTitle] = useState('')
  const [editBaselineDate, setEditBaselineDate] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)

  const replaceQuery = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!token?.trim()) {
      setLoading(false)
      setError('로그인이 필요합니다.')
      return
    }
    const range = viewQueryRange(view, anchor)
    const requested = sources.includes('google') ? sources : [...sources, 'google' as const]
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchScheduleEvents(token, { from: range.start, to: range.end, sources: requested })
      .then((data) => {
        if (cancelled) return
        setGoogle(data.google)
        setEvents(data.events.filter((event) => sources.includes(event.source)))
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(messageOf(loadError))
          setEvents([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [anchor, reloadNonce, sourcesKey, token, view])

  const onSelectView = useCallback((next: ScheduleView) => {
    const pathname = next === 'month' ? '/schedule' : `/schedule/${next}`
    navigate({ pathname, search: searchParams.toString() })
  }, [navigate, searchParams])

  const onOpenEvent = useCallback((event: ScheduleEvent) => {
    if (event.source === 'google') {
      if (event.htmlLink) {
        window.open(event.htmlLink, '_blank', 'noopener,noreferrer')
      }
      return
    }
    if (event.source === 'customer_alert' && event.customerId && event.sourceId && event.sourceTitle) {
      const title = event.sourceTitle
      const date = event.sourceDate || event.startAt.slice(0, 10)
      setEditing(event)
      setEditTitle(title)
      setEditDate(date)
      setEditBaselineTitle(title)
      setEditBaselineDate(date)
      return
    }
    if (!event.customerId) {
      return
    }
    const isMobile = window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
    if (event.source === 'car_expiry') {
      navigate(buildCustomerWorkspacePath({ customerId: event.customerId, tab: 'auto-form' }))
      return
    }
    navigate(buildExternalCustomerNavigateTarget({ customerId: event.customerId, isMobile }))
  }, [navigate])

  const onSaveEdit = useCallback(() => {
    if (!token?.trim() || !editing?.customerId || editing.source !== 'customer_alert') {
      return
    }
    const title = editTitle.trim()
    if (!title || !editDate) {
      setError('내용과 날짜를 입력해 주세요.')
      return
    }
    void updateCustomerSpecialDate(token, editing.customerId, Number(editing.sourceId), {
      title,
      dateValue: editDate,
    }).then(() => {
      setEditing(null)
      setReloadNonce((current) => current + 1)
    }).catch((saveError: unknown) => setError(messageOf(saveError)))
  }, [editDate, editTitle, editing, token])

  return {
    token: token ?? '',
    view,
    anchor,
    sources,
    events,
    google,
    loading,
    error,
    editing,
    editTitle,
    editDate,
    editDirty: editing != null && (editTitle !== editBaselineTitle || editDate !== editBaselineDate),
    onSelectView,
    onShift: (delta) => replaceQuery({ date: shiftAnchor(view, anchor, delta) }),
    onSelectDate: (date) => {
      const next = new URLSearchParams(searchParams)
      next.set('date', date)
      navigate({ pathname: '/schedule/day', search: next.toString() })
    },
    onToggleSource: (source) => {
      if (source === 'all') {
        replaceQuery({ sources: '' })
        return
      }
      const hasAll = sources.length === ALL_SOURCES.length
      const next = hasAll
        ? [source]
        : sources.includes(source)
          ? sources.filter((item) => item !== source)
          : [...sources, source]
      const normalized = next.length === 0 || next.length === ALL_SOURCES.length ? [] : next
      replaceQuery({ sources: normalized.join(',') })
    },
    onOpenEvent,
    onOpenIntegrations: () => navigate('/service-integrations'),
    onEditTitle: setEditTitle,
    onEditDate: setEditDate,
    onCloseEdit: () => setEditing(null),
    onSaveEdit,
  }
}
