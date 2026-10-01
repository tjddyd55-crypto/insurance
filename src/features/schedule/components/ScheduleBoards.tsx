import { FormButton, FormInput } from '../../../components/form'
import { FormDialog } from '../../../components/dialog'
import { SCHEDULE_SOURCE_LABEL, type ScheduleEvent } from '../api/scheduleApi'
import type { ScheduleViewProps } from '../hooks/useScheduleState'
import { addDaysYmd, monthCells, weekDays } from '../domain/scheduleRange'

const WEEKDAY = ['월', '화', '수', '목', '금', '토', '일']
const HOURS = Array.from({ length: 24 }, (_, index) => index)

function eventDay(event: ScheduleEvent): string {
  if (event.allDay) {
    return event.startAt.slice(0, 10)
  }
  const parsed = new Date(event.startAt)
  if (Number.isNaN(parsed.getTime())) {
    return event.startAt.slice(0, 10)
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

function eventClock(event: ScheduleEvent): string {
  if (event.allDay) {
    return '종일'
  }
  const parsed = new Date(event.startAt)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsed)
}

function coversDate(event: ScheduleEvent, date: string): boolean {
  if (!event.allDay) {
    return eventDay(event) === date
  }
  const start = event.startAt.slice(0, 10)
  const endRaw = event.endAt.slice(0, 10)
  const endInclusive = !endRaw || endRaw <= start ? start : addDaysYmd(endRaw, -1)
  return start <= date && date <= endInclusive
}

function eventHour(event: ScheduleEvent): number | null {
  if (event.allDay) {
    return null
  }
  const parsed = new Date(event.startAt)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(parsed)
  return Number(hour)
}

function byStart(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((left, right) => eventDay(left).localeCompare(eventDay(right)) || eventClock(left).localeCompare(eventClock(right)))
}

export function ScheduleMonth({ anchor, events, onSelectDate, onOpenEvent }: Pick<ScheduleViewProps, 'anchor' | 'events' | 'onSelectDate' | 'onOpenEvent'>) {
  return (
    <div className="schedule-page__month">
      {['일', '월', '화', '수', '목', '금', '토'].map((label) => (
        <span key={label} className="schedule-page__weekday">{label}</span>
      ))}
      {monthCells(anchor).map((cell) => {
        const dayEvents = events.filter((event) => coversDate(event, cell.date))
        const visible = dayEvents.slice(0, 3)
        const overflow = dayEvents.length - visible.length
        return (
          <div key={cell.date} className={cell.inMonth ? 'schedule-page__cell' : 'schedule-page__cell schedule-page__cell--muted'}>
            <button type="button" className="schedule-page__date" onClick={() => onSelectDate(cell.date)}>
              {Number(cell.date.slice(8))}
            </button>
            {visible.map((event) => (
              <button key={event.id} type="button" className={`schedule-page__chip schedule-page__chip--${event.source}`} onClick={() => onOpenEvent(event)}>
                {event.title}
              </button>
            ))}
            {overflow > 0 ? <span className="schedule-page__more">+{overflow}개</span> : null}
          </div>
        )
      })}
    </div>
  )
}

export function ScheduleWeek({ anchor, events, onOpenEvent }: Pick<ScheduleViewProps, 'anchor' | 'events' | 'onOpenEvent'>) {
  const days = weekDays(anchor)
  return (
    <div className="schedule-page__week">
      <div className="schedule-page__week-head">
        <span />
        {days.map((date, index) => (
          <strong key={date}>{WEEKDAY[index]} {Number(date.slice(8))}</strong>
        ))}
      </div>
      <div className="schedule-page__all-day">
        <span>종일</span>
        {days.map((date) => (
          <div key={date}>
            {events.filter((event) => event.allDay && coversDate(event, date)).map((event) => (
              <button key={event.id} type="button" onClick={() => onOpenEvent(event)}>{event.title}</button>
            ))}
          </div>
        ))}
      </div>
      <div className="schedule-page__hours">
        {HOURS.map((hour) => (
          <div key={hour} className="schedule-page__hour-row">
            <span>{String(hour).padStart(2, '0')}:00</span>
            {days.map((date) => (
              <div key={date}>
                {events.filter((event) => !event.allDay && eventDay(event) === date && eventHour(event) === hour).map((event) => (
                  <button key={event.id} type="button" onClick={() => onOpenEvent(event)}>
                    {eventClock(event)} {event.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ScheduleDayList({ events, onOpenEvent, detailed }: {
  events: ScheduleEvent[]
  onOpenEvent: (event: ScheduleEvent) => void
  detailed: boolean
}) {
  const rows = byStart(events)
  if (rows.length === 0) {
    return <p className="schedule-page__empty">이 기간의 일정이 없습니다.</p>
  }
  return (
    <ul className="schedule-page__day-list">
      {rows.map((event) => (
        <li key={event.id}>
          <button type="button" onClick={() => onOpenEvent(event)}>
            <span>{eventDay(event)} {eventClock(event)}</span>
            <strong>{event.title}</strong>
            {detailed ? <span>{event.customerName || '고객 없음'}</span> : null}
            <span>{SCHEDULE_SOURCE_LABEL[event.source]}</span>
            {detailed ? <span>{event.phone || '전화 없음'}</span> : null}
            {detailed ? <span>{event.description || '메모 없음'}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ScheduleEventDialog(props: ScheduleViewProps) {
  if (!props.editing) {
    return null
  }
  return (
    <FormDialog
      open
      title="고객 알림 수정"
      closeOnBackdrop={false}
      closeOnEsc={false}
      onEscapeRequest={props.onCloseEdit}
      onClose={props.onCloseEdit}
      footer={(
        <div className="schedule-page__dialog-actions">
          <FormButton htmlType="button" variant="secondary" onClick={props.onCloseEdit}>취소</FormButton>
          <FormButton htmlType="button" variant="primary" onClick={props.onSaveEdit}>저장</FormButton>
        </div>
      )}
    >
      <label className="schedule-page__field">
        <span>제목</span>
        <FormInput value={props.editTitle} onChange={(event) => props.onEditTitle(event.target.value)} />
      </label>
      <label className="schedule-page__field">
        <span>날짜</span>
        <FormInput type="date" value={props.editDate} onChange={(event) => props.onEditDate(event.target.value)} />
      </label>
    </FormDialog>
  )
}
