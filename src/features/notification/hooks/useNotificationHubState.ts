import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import {
  deleteCustomerSpecialDate,
  updateCustomerSpecialDate,
} from '../../customers/api/customerSpecialDatesApi'
import { buildExternalCustomerNavigateTarget } from '../../customers/utils/customerRoutePaths'
import {
  fetchReminderCalendar,
  fetchReminderList,
  type ReminderDayCount,
  type ReminderEvent,
} from '../api/reminderApi'

export type NotificationHubTab = 'today' | 'calendar' | 'all'

export function notificationHubTabFromPath(pathname: string): NotificationHubTab {
  if (pathname.startsWith('/notifications/calendar')) {
    return 'calendar'
  }
  if (pathname.startsWith('/notifications/all')) {
    return 'all'
  }
  return 'today'
}

function seoulMonth(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
}

function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split('-')
  const cursor = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1))
  const year = cursor.getUTCFullYear()
  const nextMonth = String(cursor.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${nextMonth}`
}

export type NotificationHubViewProps = {
  token: string
  tab: NotificationHubTab
  error: string
  loading: boolean
  month: string
  selectedDay: string
  days: ReminderDayCount[]
  events: ReminderEvent[]
  dayEvents: ReminderEvent[]
  listType: string
  query: string
  from: string
  to: string
  sort: string
  editing: ReminderEvent | null
  editTitle: string
  editDate: string
  editDirty: boolean
  onSelectTab: (tab: NotificationHubTab) => void
  onShiftMonth: (delta: number) => void
  onSelectDay: (date: string) => void
  onOpenCustomer: (event: ReminderEvent) => void
  onListType: (value: string) => void
  onQuery: (value: string) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onSort: (value: string) => void
  onEdit: (event: ReminderEvent) => void
  onEditTitle: (value: string) => void
  onEditDate: (value: string) => void
  onCloseEdit: () => void
  onSaveEdit: () => void
  onDelete: (event: ReminderEvent) => void
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : '알림을 불러오지 못했습니다.'
}

export function useNotificationHubState(tab: NotificationHubTab): NotificationHubViewProps {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const month = searchParams.get('month') || seoulMonth()
  const selectedDay = searchParams.get('day') ?? ''
  const listType = searchParams.get('type') || 'all'
  const query = searchParams.get('q') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const sort = searchParams.get('sort') || 'soon'
  const [days, setDays] = useState<ReminderDayCount[]>([])
  const [events, setEvents] = useState<ReminderEvent[]>([])
  const [loading, setLoading] = useState(tab !== 'today')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ReminderEvent | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editBaselineTitle, setEditBaselineTitle] = useState('')
  const [editBaselineDate, setEditBaselineDate] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)

  const replaceParams = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (tab === 'today' || !token?.trim()) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    const request = tab === 'calendar'
      ? fetchReminderCalendar(token, month).then((data) => {
          if (cancelled) return
          setDays(data.days)
          setEvents(data.events)
        })
      : fetchReminderList(token, { type: listType, q: query, from, to, sort }).then((rows) => {
          if (cancelled) return
          setEvents(rows)
        })
    void request.catch((loadError: unknown) => {
      if (!cancelled) {
        setError(messageOf(loadError))
        setEvents([])
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [from, listType, month, query, reloadNonce, sort, tab, to, token])

  const onSelectTab = useCallback((next: NotificationHubTab) => {
    if (next === 'today') navigate('/notifications')
    else if (next === 'calendar') navigate('/notifications/calendar')
    else navigate('/notifications/all')
  }, [navigate])

  const onShiftMonth = useCallback((delta: number) => {
    replaceParams({ month: shiftMonth(month, delta), day: '' })
  }, [month, replaceParams])

  const onSelectDay = useCallback((date: string) => {
    replaceParams({ month: date.slice(0, 7), day: date })
  }, [replaceParams])

  const onOpenCustomer = useCallback((event: ReminderEvent) => {
    if (!event.customerId) return
    const isMobile = window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
    navigate(buildExternalCustomerNavigateTarget({ customerId: event.customerId, isMobile }))
  }, [navigate])

  const onSaveEdit = useCallback(() => {
    if (!token?.trim() || !editing?.sourceId || editing.type !== 'special_date') return
    const title = editTitle.trim()
    if (!title || !editDate) {
      setError('내용과 날짜를 입력해 주세요.')
      return
    }
    void updateCustomerSpecialDate(token, editing.customerId, editing.sourceId, {
      title,
      dateValue: editDate,
    }).then(() => {
      setEditing(null)
      setReloadNonce((current) => current + 1)
    }).catch((saveError: unknown) => setError(messageOf(saveError)))
  }, [editDate, editTitle, editing, token])

  const onDelete = useCallback((event: ReminderEvent) => {
    if (!token?.trim() || !event.sourceId) return
    void deleteCustomerSpecialDate(token, event.customerId, event.sourceId)
      .then(() => {
        setEditing(null)
        setReloadNonce((current) => current + 1)
      })
      .catch((deleteError: unknown) => setError(messageOf(deleteError)))
  }, [token])

  return {
    token: token ?? '',
    tab,
    error,
    loading,
    month,
    selectedDay,
    days,
    events,
    dayEvents: events.filter((event) => event.startDate === selectedDay),
    listType,
    query,
    from,
    to,
    sort,
    editing,
    editTitle,
    editDate,
    editDirty: editing != null && (editTitle !== editBaselineTitle || editDate !== editBaselineDate),
    onSelectTab,
    onShiftMonth,
    onSelectDay,
    onOpenCustomer,
    onListType: (value) => replaceParams({ type: value === 'all' ? '' : value }),
    onQuery: (value) => replaceParams({ q: value }),
    onFrom: (value) => replaceParams({ from: value }),
    onTo: (value) => replaceParams({ to: value }),
    onSort: (value) => replaceParams({ sort: value === 'soon' ? '' : value }),
    onEdit: (event) => {
      const title = event.sourceTitle || event.content
      const date = event.sourceDate || event.startDate
      setEditing(event)
      setEditTitle(title)
      setEditDate(date)
      setEditBaselineTitle(title)
      setEditBaselineDate(date)
    },
    onEditTitle: setEditTitle,
    onEditDate: setEditDate,
    onCloseEdit: () => setEditing(null),
    onSaveEdit,
    onDelete,
  }
}
