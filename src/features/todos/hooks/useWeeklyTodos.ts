import { useCallback, useEffect, useRef, useState } from 'react'
import { completeTodo, createTodo, listTodos, patchTodo, reopenTodo } from '../api/todosApi'
import type { TodoDto } from '../domain/todoTypes'
import { mondayOfYmd, sortWeeklyTodos } from '../domain/weeklyFocus'
import { formatSeoulYmd } from '../utils/formatSeoulYmd'

/** 오늘(Asia/Seoul)이 속한 주의 월요일 */
export function currentSeoulWeekStart(now: Date = new Date()): string {
  return mondayOfYmd(formatSeoulYmd(now))
}

type Options = {
  token: string | null | undefined
  weekStart: string
  enabled: boolean
  /** 바뀌면 다시 불러온다(예: 일정 데이터 갱신) */
  refreshKey?: unknown
  onError?: (message: string) => void
  /** 저장된 Todo(완료·주 지정 변경) 알림 — 화면 쪽 목록 동기화용 */
  onSaved?: (saved: TodoDto) => void
}

/**
 * 주간 할 일 공통 데이터(할 일 화면 · 일정 주간 보기 공용).
 * 같은 API(GET /api/todos?weekStart=&includeCompleted=1)라서 같은 주는 두 화면에서 같은 항목이 보인다.
 * 그 주로 지정한 할 일만(예정일 자동 포함 없음). 완료해도 목록에 남고(완료 표시) 미완료 뒤로 정렬.
 */
export function useWeeklyTodos({ token, weekStart, enabled, refreshKey, onError, onSaved }: Options) {
  const [state, setState] = useState<{ week: string; todos: TodoDto[] }>({ week: '', todos: [] })
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const seq = useRef(0)
  const cb = useRef({ onError, onSaved })
  useEffect(() => {
    cb.current = { onError, onSaved }
  }, [onError, onSaved])

  const reload = useCallback(async () => {
    const n = ++seq.current
    if (!enabled || !token?.trim() || !weekStart) {
      setState({ week: weekStart, todos: [] })
      return
    }
    setLoading(true)
    try {
      const rows = sortWeeklyTodos(await listTodos(token, { weekStart, includeCompleted: '1' }))
      if (n === seq.current) setState({ week: weekStart, todos: rows })
    } catch (e) {
      if (n === seq.current) {
        setState({ week: weekStart, todos: [] })
        cb.current.onError?.(e instanceof Error ? e.message : '주간 할 일을 불러오지 못했습니다.')
      }
    } finally {
      if (n === seq.current) setLoading(false)
    }
  }, [enabled, token, weekStart])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  const run = useCallback(
    async (row: TodoDto, action: () => Promise<TodoDto>, failMessage: string) => {
      if (!token?.trim()) return null
      setBusyId(row.id)
      try {
        const saved = await action()
        cb.current.onSaved?.(saved)
        await reload()
        return saved
      } catch (e) {
        cb.current.onError?.(e instanceof Error ? e.message : failMessage)
        return null
      } finally {
        setBusyId(null)
      }
    },
    [reload, token],
  )

  /** 주간 직접 지정 주 변경(null = 주간에서 빼기). due_date 는 바꾸지 않는다. */
  const setFocus = useCallback(
    (row: TodoDto, next: string | null) =>
      run(row, () => patchTodo(token!, row.id, { weeklyFocusWeekStart: next }), '주간 할 일 변경에 실패했습니다.'),
    [run, token],
  )

  /** 주간 입력: 날짜 없이(due_date·due_time null) 보고 있는 주로 지정된 새 할 일 */
  const create = useCallback(
    async (title: string) => {
      const text = title.trim()
      if (!text || !token?.trim() || !weekStart) return null
      setBusyId('__new__')
      try {
        const saved = await createTodo(token, { title: text, sourceType: 'manual', dueDate: null, dueTime: null, weeklyFocusWeekStart: weekStart })
        cb.current.onSaved?.(saved)
        await reload()
        return saved
      } catch (e) {
        cb.current.onError?.(e instanceof Error ? e.message : '주간 할 일 추가에 실패했습니다.')
        return null
      } finally {
        setBusyId(null)
      }
    },
    [reload, token, weekStart],
  )

  const toggleDone = useCallback(
    (row: TodoDto) =>
      row.status === 'completed' || row.status === 'pending'
        ? run(row, () => (row.status === 'completed' ? reopenTodo(token!, row.id) : completeTodo(token!, row.id)), '상태 변경에 실패했습니다.')
        : Promise.resolve(null),
    [run, token],
  )

  const fresh = state.week === weekStart
  return {
    todos: fresh ? state.todos : [],
    loading: loading || !fresh,
    busyId,
    reload,
    setFocus,
    create,
    toggleDone,
  }
}
