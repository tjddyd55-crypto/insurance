/* eslint-disable no-restricted-syntax -- 주간 할 일 행의 체크·제목·빼기는 목록 항목 컨트롤이라 native 요소를 쓴다(ScheduleBoards 와 같은 방식). */
import { useState, type DragEvent } from 'react'
import type { TodoDto } from '../domain/todoTypes'
import { formatWeekRangeLabel, isManualWeeklyFocus, WEEKLY_BACK_DRAG_MIME, WEEKLY_DRAG_MIME } from '../domain/weeklyFocus'
import { formatTodoDueDateDisplay } from '../utils/formatTodoDueDateDisplay'
import { todoDisplayContent } from '../utils/todoCopy'

type Props = {
  weekStart: string
  todos: TodoDto[]
  loading?: boolean
  busyId?: string | null
  onToggleDone: (row: TodoDto) => void
  onOpen: (row: TodoDto) => void
  /** 드롭/이번 주로: todoId 로 추가 */
  onDropTodoId?: (todoId: string) => void
  onRemove?: (row: TodoDto) => void
  /** 일정 주간 보기 상단처럼 가로로 넓게 */
  layout?: 'column' | 'wide'
}

/** 주간 할 일 패널(PC). 그 주 예정일(자동) + 직접 지정(수동). */
export function WeeklyTodosPanel({
  weekStart,
  todos,
  loading = false,
  busyId = null,
  onToggleDone,
  onOpen,
  onDropTodoId,
  onRemove,
  layout = 'column',
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const droppable = Boolean(onDropTodoId)

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
      className={`weekly-todos weekly-todos--${layout}${dragOver ? ' weekly-todos--drop' : ''}`}
      aria-label="주간 할 일"
      data-testid="weekly-todos-panel"
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <header className="weekly-todos__head">
        <div>
          <h2 className="weekly-todos__title">주간 할 일</h2>
          <p className="weekly-todos__desc">이번 주에 집중할 할 일을 모아봅니다.</p>
        </div>
        <span className="weekly-todos__range" data-testid="weekly-todos-range">
          {formatWeekRangeLabel(weekStart)}
        </span>
      </header>
      {dragOver ? <div className="weekly-todos__hint">주간 할 일에 추가</div> : null}
      {loading && todos.length === 0 ? (
        <p className="weekly-todos__empty">불러오는 중…</p>
      ) : todos.length === 0 ? (
        <p className="weekly-todos__empty">
          {droppable ? '이번 주 할 일이 없습니다. 오른쪽 목록에서 끌어오거나 ‘이번 주로’를 누르세요.' : '이번 주 할 일이 없습니다.'}
        </p>
      ) : (
        <ul className="weekly-todos__list">
          {todos.map((row) => {
            const manual = isManualWeeklyFocus(row, weekStart)
            return (
              <li
                key={row.id}
                className={`weekly-todos__item${manual ? ' weekly-todos__item--manual' : ''}${row.status === 'completed' ? ' weekly-todos__item--done' : ''}`}
                data-testid="weekly-todo-item"
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
                  disabled={row.status === 'canceled' || busyId === row.id}
                  onChange={() => onToggleDone(row)}
                  aria-label={row.status === 'completed' ? '완료 취소' : '완료 처리'}
                />
                <div className="weekly-todos__body">
                  <button type="button" className="weekly-todos__name" onClick={() => onOpen(row)}>
                    {todoDisplayContent(row)}
                  </button>
                  <div className="weekly-todos__meta">
                    <span>{row.dueDate ? formatTodoDueDateDisplay(row.dueDate) : '날짜 없음'}</span>
                    {row.customerName?.trim() ? <span>· {row.customerName}</span> : null}
                    <span className="weekly-todos__kind" title={manual ? '직접 추가한 할 일' : '이번 주 예정일 할 일'}>
                      {manual ? '직접 추가' : '이번 주 예정'}
                    </span>
                  </div>
                </div>
                {manual && onRemove ? (
                  <button
                    type="button"
                    className="weekly-todos__remove"
                    disabled={busyId === row.id}
                    onClick={() => onRemove(row)}
                  >
                    주간에서 빼기
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
