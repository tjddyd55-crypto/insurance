/* eslint-disable no-restricted-syntax -- 주간 할 일 행의 체크·제목·이동·빼기는 목록 항목 컨트롤이라 native 요소를 쓴다(ScheduleBoards 와 같은 방식). */
import { useState, type DragEvent } from 'react'
import type { TodoDto } from '../domain/todoTypes'
import {
  formatWeekRangeLabel,
  isDueInWeek,
  isManualWeeklyFocus,
  shiftWeekStart,
  WEEKLY_BACK_DRAG_MIME,
  WEEKLY_DRAG_MIME,
  weeklyMovePlan,
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
  className?: string
}

/**
 * 주간 할 일 패널 — 할 일 화면(/todos)과 일정 주간 보기(/schedule/week) 공용.
 * 그 주 예정일(날짜 기준, 자동) + 그 주로 직접 지정(직접 추가). 카드 모양은 둘 다 같다.
 */
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
  className = '',
}: Props) {
  const [dragOver, setDragOver] = useState(false)
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
            ‹
          </button>
        ) : null}
        <div className="weekly-todos__heading">
          <h2 className="weekly-todos__title">주간 할 일</h2>
          <span className="weekly-todos__range" data-testid="weekly-todos-range">
            {formatWeekRangeLabel(weekStart)}
          </span>
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
            ›
          </button>
        ) : null}
      </header>
      <div className="weekly-todos__scroll">
        {dragOver ? <div className="weekly-todos__hint">{formatWeekRangeLabel(weekStart)} 주간 할 일에 추가</div> : null}
        {loading && todos.length === 0 ? (
          <p className="weekly-todos__empty">불러오는 중…</p>
        ) : todos.length === 0 ? (
          <div className="weekly-todos__empty" data-testid="weekly-todos-empty">
            <p>이 주에 지정된 할 일이 없습니다.</p>
            {isCurrent ? <p className="weekly-todos__empty-sub">전체 할 일에서 이번 주로 추가할 수 있습니다.</p> : null}
          </div>
        ) : (
          <ul className="weekly-todos__list">
            {todos.map((row) => {
              const manual = isManualWeeklyFocus(row, weekStart)
              const byDate = isDueInWeek(row, weekStart)
              const prev = weeklyMovePlan(row, weekStart, -1)
              const next = weeklyMovePlan(row, weekStart, 1)
              const busy = busyId === row.id
              const pending = row.status === 'pending'
              return (
                <li
                  key={row.id}
                  className={`weekly-todos__item${row.status === 'completed' ? ' weekly-todos__item--done' : ''}`}
                  data-testid="weekly-todo-item"
                  data-todo-id={row.id}
                  data-kind={manual ? 'manual' : 'date'}
                  draggable={manual && Boolean(onRemove)}
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
                      <span
                        className="weekly-todos__kind"
                        title={manual ? '이 주로 직접 추가한 할 일' : '예정일이 이 주라서 자동으로 보이는 할 일'}
                      >
                        {manual ? '직접 추가' : byDate ? '날짜 기준' : ''}
                      </span>
                    </div>
                  </div>
                  {pending && (onMoveWeek || (manual && onRemove)) ? (
                    <div className="weekly-todos__actions">
                      {onMoveWeek ? (
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
                            ‹
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
                            ›
                          </button>
                        </>
                      ) : null}
                      {manual && onRemove ? (
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
