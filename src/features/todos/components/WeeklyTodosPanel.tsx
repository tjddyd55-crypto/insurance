/* eslint-disable no-restricted-syntax -- 주간 할 일 행의 체크·제목·이동·빼기는 목록 항목 컨트롤이라 native 요소를 쓴다(ScheduleBoards 와 같은 방식). */
import { useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { TodoDto } from '../domain/todoTypes'
import {
  formatWeekRangeLabel,
  shiftWeekStart,
  WEEKLY_BACK_DRAG_MIME,
  WEEKLY_DRAG_MIME,
  weeklyMoveTarget,
} from '../domain/weeklyFocus'
import { formatTodoDueDateDisplay } from '../utils/formatTodoDueDateDisplay'
import { todoDisplayContent } from '../utils/todoCopy'
import '../styles/weekly-todos.css'

type Props = {
  /** 보고 있는 주(월요일) */
  weekStart: string
  /** 오늘이 속한 주(월요일). 다르면 '이번 주' 버튼 표시 */
  currentWeekStart: string
  todos: TodoDto[]
  loading?: boolean
  busyId?: string | null
  /** 주 이동(‹ › · 이번 주). 없으면 이동 버튼 숨김 */
  onChangeWeek?: (weekStart: string) => void
  onToggleDone: (row: TodoDto) => void
  onOpen: (row: TodoDto) => void
  /** 드롭: 보고 있는 주로 추가(할 일 화면만) */
  onDropTodoId?: (todoId: string) => void
  /** 직접 지정 주 변경(이전/다음 주) */
  onMoveWeek?: (row: TodoDto, targetWeekStart: string) => void
  onRemove?: (row: TodoDto) => void
  /** 주간 입력(날짜 없이 이 주로). 없으면 입력 줄 숨김 */
  onCreate?: (title: string) => Promise<unknown> | void
  /** 보고 있는 주의 일정 주간 보기 링크(할 일 화면만). 없으면 숨김 */
  scheduleWeekHref?: string
  className?: string
}

/**
 * 주간 할 일 패널 — 할 일 화면(/todos)과 일정 주간 보기(/schedule/week) 공용.
 * 그 주로 지정(weekly_focus_week_start)한 할 일만 보인다. 일반 할 일 입력은 자동으로 들어오지 않는다.
 * 완료해도 남는다(체크 + 취소선), 미완료 뒤로 정렬. 모든 항목 모양 동일.
 */
/** 텍스트 ‹ › 글리프는 글꼴 기준선 때문에 아래로 ~3px 치우침 → SVG로 정확히 가운데 */
function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="weekly-todos__chevron" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={dir === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function WeeklyTodosPanel({
  weekStart,
  currentWeekStart,
  todos,
  loading = false,
  busyId = null,
  onChangeWeek,
  onToggleDone,
  onOpen,
  onDropTodoId,
  onMoveWeek,
  onRemove,
  onCreate,
  scheduleWeekHref,
  className = '',
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !onCreate || creating) return
    setCreating(true)
    try {
      await onCreate(text)
      setDraft('')
    } finally {
      setCreating(false)
    }
  }
  const droppable = Boolean(onDropTodoId)
  const isCurrent = weekStart === currentWeekStart

  const onDragOver = (event: DragEvent) => {
    if (!droppable || !event.dataTransfer.types.includes(WEEKLY_DRAG_MIME)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (!dragOver) setDragOver(true)
  }
  const onDrop = (event: DragEvent) => {
    if (!droppable) return
    const id = event.dataTransfer.getData(WEEKLY_DRAG_MIME)
    setDragOver(false)
    if (id) {
      event.preventDefault()
      onDropTodoId?.(id)
    }
  }

  return (
    <section
      className={`weekly-todos${dragOver ? ' weekly-todos--drop' : ''}${className ? ` ${className}` : ''}`}
      aria-label="주간 할 일"
      data-testid="weekly-todos-panel"
      data-week-start={weekStart}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <header className="weekly-todos__head">
        {onChangeWeek ? (
          <button
            type="button"
            className="weekly-todos__nav"
            aria-label="이전 주"
            title="이전 주"
            data-testid="weekly-todos-prev"
            onClick={() => onChangeWeek(shiftWeekStart(weekStart, -1))}
          >
            <Chevron dir="left" />
          </button>
        ) : null}
        <div className="weekly-todos__heading">
          <h2 className="weekly-todos__title">주간 할 일</h2>
          <span className="weekly-todos__range" data-testid="weekly-todos-range">
            {formatWeekRangeLabel(weekStart)}
          </span>
          {scheduleWeekHref ? (
            <Link
              to={scheduleWeekHref}
              className="weekly-todos__to-schedule"
              data-testid="weekly-todos-to-schedule"
              title={`${formatWeekRangeLabel(weekStart)} 주간 일정 보기`}
            >
              주간 일정으로 이동 ›
            </Link>
          ) : null}
        </div>
        {onChangeWeek && !isCurrent ? (
          <button
            type="button"
            className="weekly-todos__this-week"
            data-testid="weekly-todos-this-week"
            onClick={() => onChangeWeek(currentWeekStart)}
          >
            이번 주
          </button>
        ) : null}
        {onChangeWeek ? (
          <button
            type="button"
            className="weekly-todos__nav"
            aria-label="다음 주"
            title="다음 주"
            data-testid="weekly-todos-next"
            onClick={() => onChangeWeek(shiftWeekStart(weekStart, 1))}
          >
            <Chevron dir="right" />
          </button>
        ) : null}
      </header>
      {onCreate ? (
        <form className="weekly-todos__new" data-testid="weekly-todos-new" onSubmit={(e) => void submit(e)}>
          <input
            type="text"
            className="weekly-todos__new-input"
            data-testid="weekly-todos-new-input"
            placeholder={`${formatWeekRangeLabel(weekStart)} 주간에 할 일 적기`}
            aria-label="주간 할 일 입력"
            value={draft}
            maxLength={500}
            disabled={creating}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="weekly-todos__new-add" data-testid="weekly-todos-new-add" disabled={creating || !draft.trim()}>
            추가
          </button>
        </form>
      ) : null}
      <div className="weekly-todos__scroll">
        {dragOver ? <div className="weekly-todos__hint">{formatWeekRangeLabel(weekStart)} 주간 할 일에 추가</div> : null}
        {loading && todos.length === 0 ? (
          <p className="weekly-todos__empty">불러오는 중…</p>
        ) : todos.length === 0 ? (
          <div className="weekly-todos__empty" data-testid="weekly-todos-empty">
            <p>이 주에 지정된 할 일이 없습니다.</p>
            {isCurrent ? <p className="weekly-todos__empty-sub">위에 적거나 전체 할 일에서 이번 주로 추가할 수 있습니다.</p> : null}
          </div>
        ) : (
          <ul className="weekly-todos__list">
            {todos.map((row) => {
              const prev = weeklyMoveTarget(weekStart, -1)
              const next = weeklyMoveTarget(weekStart, 1)
              const busy = busyId === row.id
              const pending = row.status === 'pending'
              return (
                <li
                  key={row.id}
                  className={`weekly-todos__item${row.status === 'completed' ? ' weekly-todos__item--done' : ''}`}
                  data-testid="weekly-todo-item"
                  data-todo-id={row.id}
                  data-status={row.status}
                  draggable={Boolean(onRemove)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(WEEKLY_BACK_DRAG_MIME, row.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                >
                  <input
                    type="checkbox"
                    className="accent-brand weekly-todos__check"
                    checked={row.status === 'completed'}
                    disabled={row.status === 'canceled' || busy}
                    onChange={() => onToggleDone(row)}
                    aria-label={row.status === 'completed' ? '완료 취소' : '완료 처리'}
                  />
                  <div className="weekly-todos__body">
                    <button type="button" className="weekly-todos__name" title={todoDisplayContent(row)} onClick={() => onOpen(row)}>
                      {todoDisplayContent(row)}
                    </button>
                    <div className="weekly-todos__meta">
                      <span>{row.dueDate ? formatTodoDueDateDisplay(row.dueDate) : '날짜 없음'}</span>
                      {row.customerName?.trim() ? <span>· {row.customerName}</span> : null}
                      {row.status === 'completed' ? <span className="weekly-todos__done-mark">완료</span> : null}
                    </div>
                  </div>
                  {onMoveWeek || onRemove ? (
                    <div className="weekly-todos__actions">
                      {onMoveWeek && pending ? (
                        <>
                          <button
                            type="button"
                            className="weekly-todos__move"
                            aria-label={prev.label}
                            title={`${prev.label} (${formatWeekRangeLabel(prev.target)})`}
                            data-testid="weekly-todo-move-prev"
                            disabled={busy}
                            onClick={() => onMoveWeek(row, prev.target)}
                          >
                            <Chevron dir="left" />
                          </button>
                          <button
                            type="button"
                            className="weekly-todos__move"
                            aria-label={next.label}
                            title={`${next.label} (${formatWeekRangeLabel(next.target)})`}
                            data-testid="weekly-todo-move-next"
                            disabled={busy}
                            onClick={() => onMoveWeek(row, next.target)}
                          >
                            <Chevron dir="right" />
                          </button>
                        </>
                      ) : null}
                      {onRemove ? (
                        <button
                          type="button"
                          className="weekly-todos__remove"
                          data-testid="weekly-todo-remove"
                          disabled={busy}
                          onClick={() => onRemove(row)}
                        >
                          주간에서 빼기
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
