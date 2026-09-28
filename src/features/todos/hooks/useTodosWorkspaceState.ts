import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import type { TodoCreatePrefill } from '../components/TodoEditorDialog'
import type { TodoDto } from '../domain/todoTypes'
import { completeTodo, listTodos, reopenTodo } from '../api/todosApi'
import { getCalendarMonthRange, shiftCalendarMonth } from '../domain/todoCalendar'
import {
  readTodosViewMode,
  writeTodosViewMode,
  type TodosViewMode,
} from '../storage/todosUiStorage'
import { formatSeoulYmd } from '../utils/formatSeoulYmd'
import { buildRelatedEntityHref } from '../utils/relatedEntityNavigate'

export type TodoQuickFilter =
  | 'all'
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'open'
  | 'completed'
  | 'overdue'
export type TodoRelatedFilter = 'any' | 'yes' | 'no'

export function useTodosWorkspaceState() {
  const { token, user } = useAuth()
  const gaId = user?.gaId != null && Number.isFinite(Number(user.gaId)) ? Number(user.gaId) : null
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [quick, setQuick] = useState<TodoQuickFilter>('open')
  const [relatedFilter, setRelatedFilter] = useState<TodoRelatedFilter>('any')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [viewMode, setViewModeState] = useState<TodosViewMode>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => formatSeoulYmd(new Date()).slice(0, 7))

  const [loading, setLoading] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [error, setError] = useState('')
  const [todos, setTodos] = useState<TodoDto[]>([])
  const [calendarTodos, setCalendarTodos] = useState<TodoDto[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSession, setEditorSession] = useState(0)
  const [editingTodo, setEditingTodo] = useState<TodoDto | null>(null)
  const [editorPrefill, setEditorPrefill] = useState<TodoCreatePrefill | null>(null)

  useEffect(() => {
    if (user?.id) setViewModeState(readTodosViewMode(String(user.id)))
  }, [user?.id])

  const setViewMode = useCallback((mode: TodosViewMode) => {
    setViewModeState(mode)
    if (user?.id) writeTodosViewMode(String(user.id), mode)
  }, [user?.id])

  const listParams = useMemo(() => {
    const ps: Parameters<typeof listTodos>[1] = {}
    if (quick === 'open') ps.bucket = 'open'
    if (quick === 'completed') ps.status = 'completed'
    if (quick === 'today') ps.due = 'today'
    if (quick === 'tomorrow') ps.due = 'tomorrow'
    if (quick === 'week') ps.due = 'week'
    if (quick === 'overdue') ps.overdue = 'true'
    if (relatedFilter === 'yes') ps.hasRelated = 'yes'
    if (relatedFilter === 'no') ps.hasRelated = 'no'
    if (sourceFilter !== 'all') ps.sourceType = sourceFilter
    return ps
  }, [quick, relatedFilter, sourceFilter])

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setTodos([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await listTodos(token, listParams)
      setTodos(rows)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'
      setError(msg)
      setTodos([])
    } finally {
      setLoading(false)
    }
  }, [token, listParams])

  const calendarParams = useMemo(() => {
    const range = getCalendarMonthRange(calendarMonth)
    const ps: Parameters<typeof listTodos>[1] = {
      dueFrom: range.from,
      dueTo: range.to,
    }
    if (relatedFilter === 'yes') ps.hasRelated = 'yes'
    if (relatedFilter === 'no') ps.hasRelated = 'no'
    if (sourceFilter !== 'all') ps.sourceType = sourceFilter
    return ps
  }, [calendarMonth, relatedFilter, sourceFilter])

  const loadCalendar = useCallback(async () => {
    if (!token?.trim()) {
      setCalendarTodos([])
      return
    }
    setCalendarLoading(true)
    setError('')
    try {
      setCalendarTodos(await listTodos(token, calendarParams))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '달력 일정을 불러오지 못했습니다.')
      setCalendarTodos([])
    } finally {
      setCalendarLoading(false)
    }
  }, [calendarParams, token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (viewMode === 'calendar') void loadCalendar()
  }, [loadCalendar, viewMode])

  const openCreateBlank = (dueDate?: string) => {
    setEditingTodo(null)
    setEditorPrefill({
      sourceType: 'manual',
      description: '',
      dueDate: dueDate ?? null,
    })
    setEditorSession((k) => k + 1)
    setEditorOpen(true)
  }

  const openEdit = (row: TodoDto) => {
    setEditingTodo(row)
    setEditorPrefill(null)
    setEditorSession((k) => k + 1)
    setEditorOpen(true)
  }

  const toggleDone = async (row: TodoDto) => {
    if (!token?.trim()) return
    setError('')
    try {
      let nextRow: TodoDto
      if (row.status === 'completed') {
        nextRow = await reopenTodo(token, row.id)
      } else if (row.status === 'pending') {
        nextRow = await completeTodo(token, row.id)
      } else {
        return
      }
      setTodos((prev) => prev.map((t) => (t.id === nextRow.id ? nextRow : t)))
      await load()
      if (viewMode === 'calendar') await loadCalendar()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '상태 변경에 실패했습니다.'
      setError(msg)
    }
  }

  const onRelatedNavigate = useCallback(
    (row: TodoDto) => {
      const href = buildRelatedEntityHref(row.relatedEntityType, row.relatedEntityId, {
        isMobile,
      })
      if (href) {
        const customerName = row.customerName?.trim()
        navigate(href, {
          replace: false,
          state: customerName ? { customerName } : undefined,
        })
        return true
      }
      return false
    },
    [isMobile, navigate],
  )

  return {
    token: token ?? '',
    gaId,
    todos,
    calendarTodos,
    loading,
    calendarLoading,
    error,
    quickFilter: quick,
    setQuickFilter: setQuick,
    relatedFilter,
    setRelatedFilter,
    sourceFilter,
    setSourceFilter,
    viewMode,
    setViewMode,
    calendarMonth,
    showPreviousMonth: () => setCalendarMonth((month) => shiftCalendarMonth(month, -1)),
    showNextMonth: () => setCalendarMonth((month) => shiftCalendarMonth(month, 1)),
    showCurrentMonth: () => setCalendarMonth(formatSeoulYmd(new Date()).slice(0, 7)),
    reload: load,
    reloadCalendar: loadCalendar,
    editorOpen,
    setEditorOpen,
    editorSession,
    editingTodo,
    editorPrefill,
    openCreateBlank,
    openEdit,
    toggleDone,
    onRelatedNavigate,
  }
}
