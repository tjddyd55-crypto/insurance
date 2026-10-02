/* eslint-disable no-restricted-syntax -- 달력 칸·일정 칩·목록 행은 버튼 모양이 아닌 목록 항목이라 native button 을 쓴다(알림 달력과 같은 방식). 툴바 버튼은 공용 Button. */
import { FormButton, FormInput } from '../../../components/form'
import { FormDialog } from '../../../components/dialog'
import { Button } from '../../../components/ui'
import { formatKstTime } from '../../../utils/displayDateTime'
import { formatDateWithKoreanWeekday } from '../../../utils/formatDateWithKoreanWeekday'
import { SCHEDULE_FILTER_LABEL, scheduleFilterKeyOf, type ScheduleEvent } from '../api/scheduleApi'
import type { ScheduleViewProps } from '../hooks/useScheduleState'
import { monthCells, weekDays } from '../domain/scheduleRange'
import {
  eventClock,
  eventCoversDate,
  eventEndDay,
  eventHour,
  eventStartDay,
  sortScheduleEvents,
} from '../domain/scheduleEventTime'

const WEEKDAY_MON_FIRST = ['월', '화', '수', '목', '금', '토', '일']
const WEEKDAY_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 24 }, (_, index) => index)
const MONTH_CELL_LIMIT = 3

export function ScheduleSourceBadge({ event }: { event: ScheduleEvent }) {
  const key = scheduleFilterKeyOf(event)
  return <span className={`schedule-page__badge schedule-page__badge--${key}`}>{SCHEDULE_FILTER_LABEL[key]}</span>
}

function eventButtonClass(base: string, event: ScheduleEvent): string {
  return `${base} ${base}--${scheduleFilterKeyOf(event)}`
}

type MonthProps = Pick<ScheduleViewProps, 'anchor' | 'today' | 'events' | 'selectedDate' | 'onSelectDate' | 'onOpenDay' | 'onOpenEvent'>

export function ScheduleMonth({ anchor, today, events, selectedDate, onSelectDate, onOpenDay, onOpenEvent }: MonthProps) {
  const sorted = sortScheduleEvents(events)
  const selectedEvents = selectedDate ? sorted.filter((event) => eventCoversDate(event, selectedDate)) : []
  return (
    <>
      <div className="schedule-page__month" role="grid" aria-label="월간 일정">
        {WEEKDAY_SUN_FIRST.map((label) => (
          <span key={label} className="schedule-page__weekday" role="columnheader">{label}</span>
        ))}
        {monthCells(anchor).map((cell) => {
          const dayEvents = sorted.filter((event) => eventCoversDate(event, cell.date))
          const visible = dayEvents.slice(0, MONTH_CELL_LIMIT)
          const overflow = dayEvents.length - visible.length
          const classes = ['schedule-page__cell']
          if (!cell.inMonth) classes.push('schedule-page__cell--muted')
          if (cell.date === today) classes.push('schedule-page__cell--today')
          if (cell.date === selectedDate) classes.push('schedule-page__cell--selected')
          return (
            <div key={cell.date} className={classes.join(' ')} role="gridcell">
              <button
                type="button"
                className="schedule-page__date"
                aria-label={`${formatDateWithKoreanWeekday(cell.date)} 일정 ${dayEvents.length}건`}
                aria-pressed={cell.date === selectedDate}
                onClick={() => onSelectDate(cell.date)}
              >
                {Number(cell.date.slice(8))}
              </button>
              {visible.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={eventButtonClass('schedule-page__chip', event)}
                  title={`${SCHEDULE_FILTER_LABEL[scheduleFilterKeyOf(event)]} · ${event.title}`}
                  onClick={() => onOpenEvent(event)}
                >
                  {event.title}
                </button>
              ))}
              {overflow > 0 ? (
                <button type="button" className="schedule-page__more" onClick={() => onSelectDate(cell.date)}>
                  +{overflow}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      {selectedDate ? (
        <section className="schedule-page__day-panel" aria-label={`${formatDateWithKoreanWeekday(selectedDate)} 일정`}>
          <div className="schedule-page__day-panel-head">
            <strong>{formatDateWithKoreanWeekday(selectedDate)}</strong>
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenDay(selectedDate)}>일간 보기</Button>
          </div>
          <ScheduleDayList events={selectedEvents} onOpenEvent={onOpenEvent} detailed={false} showDate={false} />
        </section>
      ) : null}
    </>
  )
}

export function ScheduleWeek({ anchor, today, events, onOpenEvent }: Pick<ScheduleViewProps, 'anchor' | 'today' | 'events' | 'onOpenEvent'>) {
  const days = weekDays(anchor)
  const sorted = sortScheduleEvents(events)
  return (
    <div className="schedule-page__week" aria-label="주간 일정">
      <div className="schedule-page__week-grid">
        <div className="schedule-page__week-head">
          <span />
          {days.map((date, index) => (
            <strong key={date} className={date === today ? 'schedule-page__week-day schedule-page__week-day--today' : 'schedule-page__week-day'}>
              {WEEKDAY_MON_FIRST[index]} {Number(date.slice(8))}
            </strong>
          ))}
        </div>
        <div className="schedule-page__all-day">
          <span className="schedule-page__axis">종일</span>
          {days.map((date) => (
            <div key={date} className="schedule-page__slot">
              {sorted.filter((event) => event.allDay && eventCoversDate(event, date)).map((event) => (
                <button key={event.id} type="button" className={eventButtonClass('schedule-page__block', event)} onClick={() => onOpenEvent(event)}>
                  {event.title}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="schedule-page__hours">
          {HOURS.map((hour) => (
            <div key={hour} className="schedule-page__hour-row">
              <span className="schedule-page__axis">{String(hour).padStart(2, '0')}:00</span>
              {days.map((date) => (
                <div key={date} className="schedule-page__slot">
                  {sorted.filter((event) => !event.allDay && eventStartDay(event) === date && eventHour(event) === hour).map((event) => (
                    <button key={event.id} type="button" className={eventButtonClass('schedule-page__block', event)} onClick={() => onOpenEvent(event)}>
                      <span className="schedule-page__block-time">{formatKstTime(event.startAt)}</span> {event.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ScheduleDayList({ events, onOpenEvent, detailed, showDate = true }: {
  events: ScheduleEvent[]
  onOpenEvent: (event: ScheduleEvent) => void
  detailed: boolean
  showDate?: boolean
}) {
  const rows = sortScheduleEvents(events)
  if (rows.length === 0) {
    return <p className="schedule-page__empty">이 기간의 일정이 없습니다.</p>
  }
  return (
    <ul className={detailed ? 'schedule-page__day-list schedule-page__day-list--detailed' : 'schedule-page__day-list'}>
      {rows.map((event) => (
        <li key={event.id}>
          <button type="button" onClick={() => onOpenEvent(event)}>
            <span className="schedule-page__row-time">
              {showDate ? `${formatDateWithKoreanWeekday(eventStartDay(event))} ` : ''}{eventClock(event)}
            </span>
            <strong className="schedule-page__row-title">{event.title}</strong>
            <ScheduleSourceBadge event={event} />
            {event.customerName ? <span className="schedule-page__row-meta">{event.customerName}</span> : null}
            {detailed && event.location ? <span className="schedule-page__row-meta">{event.location}</span> : null}
            {detailed && event.description ? <span className="schedule-page__row-desc">{event.description}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

function detailWhen(event: ScheduleEvent): string {
  const start = eventStartDay(event)
  const end = eventEndDay(event)
  const dateLabel = start === end
    ? formatDateWithKoreanWeekday(start)
    : `${formatDateWithKoreanWeekday(start)} ~ ${formatDateWithKoreanWeekday(end)}`
  return event.allDay ? `${dateLabel} 종일` : `${dateLabel} ${eventClock(event)}`
}

/** Google 일정 읽기 전용 상세. 조회 전용이라 바깥 클릭·ESC 로 닫을 수 있다. */
export function ScheduleGoogleDetailDialog({ detail, onCloseDetail }: Pick<ScheduleViewProps, 'detail' | 'onCloseDetail'>) {
  if (!detail) {
    return null
  }
  return (
    <FormDialog
      open
      title={detail.title}
      closeOnBackdrop
      closeOnEsc
      onClose={onCloseDetail}
      footer={(
        <div className="schedule-page__dialog-actions">
          {detail.htmlLink ? (
            <a className="schedule-page__link-button" href={detail.htmlLink} target="_blank" rel="noopener noreferrer">
              Google Calendar에서 열기
            </a>
          ) : null}
          <FormButton htmlType="button" variant="secondary" onClick={onCloseDetail}>닫기</FormButton>
        </div>
      )}
    >
      <dl className="schedule-page__detail">
        <div><dt>일시</dt><dd>{detailWhen(detail)}</dd></div>
        <div><dt>캘린더</dt><dd>{detail.calendarName || '기본 캘린더'}</dd></div>
        {detail.location ? <div><dt>위치</dt><dd>{detail.location}</dd></div> : null}
        {detail.description ? <div><dt>설명</dt><dd className="schedule-page__detail-desc">{detail.description}</dd></div> : null}
        <div><dt>출처</dt><dd><ScheduleSourceBadge event={detail} /> 읽기 전용</dd></div>
      </dl>
    </FormDialog>
  )
}

export function ScheduleEventDialog(props: ScheduleViewProps) {
  if (!props.editing) {
    return null
  }
  const editing = props.editing
  return (
    <FormDialog
      open
      title="알림일 수정"
      closeOnBackdrop={false}
      closeOnEsc={false}
      onEscapeRequest={props.onCloseEdit}
      onClose={props.onCloseEdit}
      footer={(
        <div className="schedule-page__dialog-actions">
          {editing.customerId ? (
            <FormButton htmlType="button" variant="secondary" onClick={() => props.onOpenCustomer(editing)}>고객 상세</FormButton>
          ) : null}
          <FormButton htmlType="button" variant="secondary" onClick={props.onCloseEdit}>취소</FormButton>
          <FormButton htmlType="button" variant="primary" onClick={props.onSaveEdit}>저장</FormButton>
        </div>
      )}
    >
      {editing.customerName ? <p className="schedule-page__dialog-sub">{editing.customerName}</p> : null}
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
