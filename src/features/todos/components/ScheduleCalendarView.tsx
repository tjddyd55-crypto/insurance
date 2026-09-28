import { useMemo, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { FormButton } from '../../../components/form'
import type { TodoDto } from '../domain/todoTypes'
import { buildCalendarMatrix, groupTodosByDueDate } from '../domain/todoCalendar'
import { todoDisplayContent, todoSourceLabel } from '../utils/todoCopy'
import { formatSeoulYmd } from '../utils/formatSeoulYmd'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function dateDialogTitle(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return `${year}년 ${month}월 ${day}일 일정`
}

export function ScheduleCalendarView({
  month,
  todos,
  loading,
  compact,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onEdit,
  onCreate,
}: {
  month: string
  todos: TodoDto[]
  loading: boolean
  compact: boolean
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onEdit: (todo: TodoDto) => void
  onCreate: (date: string) => void
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const matrix = useMemo(() => buildCalendarMatrix(month), [month])
  const grouped = useMemo(() => groupTodosByDueDate(todos), [todos])
  const today = formatSeoulYmd(new Date())
  const visibleCount = compact ? 1 : 3
  const selectedTodos = selectedDate ? grouped.get(selectedDate) ?? [] : []
  const [year, monthNumber] = month.split('-').map(Number)

  return (
    <section className={`todos-calendar${compact ? ' todos-calendar--compact' : ''}`}>
      <header className="todos-calendar__header">
        <FormButton variant="action" onClick={onPreviousMonth} aria-label="이전 달">‹</FormButton>
        <h2>{year}년 {monthNumber}월</h2>
        <FormButton variant="action" onClick={onNextMonth} aria-label="다음 달">›</FormButton>
        <FormButton variant="secondary" onClick={onToday}>오늘</FormButton>
      </header>

      {loading ? <p className="text-muted">달력 일정을 불러오는 중…</p> : null}

      <div className="todos-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="todos-calendar__grid">
        {matrix.map((day) => {
          const dayTodos = grouped.get(day.date) ?? []
          const hiddenCount = Math.max(0, dayTodos.length - visibleCount)
          return (
            <div
              key={day.date}
              className={[
                'todos-calendar__day',
                day.inCurrentMonth ? '' : 'is-outside',
                day.date === today ? 'is-today' : '',
              ].filter(Boolean).join(' ')}
            >
              <FormButton
                variant="action"
                className="todos-calendar__date"
                onClick={() => setSelectedDate(day.date)}
                aria-label={`${day.date} 일정 ${dayTodos.length}건`}
              >
                <span>{day.dayOfMonth}</span>
                {day.date === today ? <small>오늘</small> : null}
              </FormButton>
              <div className="todos-calendar__events">
                {dayTodos.slice(0, visibleCount).map((todo) => (
                  <FormButton
                    key={todo.id}
                    variant="action"
                    className="todos-calendar__event"
                    title={todoDisplayContent(todo)}
                    onClick={() => onEdit(todo)}
                  >
                    <span>[{todoSourceLabel(todo.sourceType)}]</span> {todo.customerName || todoDisplayContent(todo)}
                  </FormButton>
                ))}
                {hiddenCount > 0 ? (
                  <FormButton
                    variant="action"
                    className="todos-calendar__more"
                    onClick={() => setSelectedDate(day.date)}
                  >
                    +{hiddenCount} 더보기
                  </FormButton>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <BaseDialog
        open={Boolean(selectedDate)}
        onClose={() => setSelectedDate(null)}
        closeOnBackdrop={false}
        ariaLabel={selectedDate ? dateDialogTitle(selectedDate) : '날짜 일정'}
      >
        <h2 className="todos-calendar-dialog__title">
          {selectedDate ? dateDialogTitle(selectedDate) : ''}
        </h2>
        <div className="todos-calendar-dialog__list">
          {selectedTodos.length === 0 ? (
            <p className="text-muted">등록된 일정이 없습니다.</p>
          ) : selectedTodos.map((todo) => (
            <FormButton
              key={todo.id}
              variant="action"
              className="todos-calendar-dialog__event"
              onClick={() => {
                setSelectedDate(null)
                onEdit(todo)
              }}
            >
              <strong>{todo.dueTime || '종일'} · {todoSourceLabel(todo.sourceType)}</strong>
              <span>{todo.customerName || '연결 고객 없음'}</span>
              <span>{todoDisplayContent(todo)}</span>
            </FormButton>
          ))}
        </div>
        <div className="todos-calendar-dialog__actions">
          <FormButton variant="secondary" onClick={() => setSelectedDate(null)}>닫기</FormButton>
          <FormButton
            variant="primary"
            onClick={() => {
              if (!selectedDate) return
              const date = selectedDate
              setSelectedDate(null)
              onCreate(date)
            }}
          >
            새 일정 추가
          </FormButton>
        </div>
      </BaseDialog>
    </section>
  )
}
