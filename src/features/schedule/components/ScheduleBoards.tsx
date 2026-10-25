/* eslint-disable no-restricted-syntax -- 달력 칸·일정 칩·목록 행은 버튼 모양이 아닌 목록 항목이라 native button 을 쓴다(알림 달력과 같은 방식). 툴바 버튼은 공용 Button. */
import type { ReactNode } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { FormDialog } from '../../../components/dialog'
import { Button } from '../../../components/ui'
import { formatKstTime } from '../../../utils/displayDateTime'
import { formatDateWithKoreanWeekday } from '../../../utils/formatDateWithKoreanWeekday'
import { SCHEDULE_FILTER_LABEL, scheduleFilterKeyOf, type ScheduleEvent, type ScheduleTask } from '../api/scheduleApi'
import type { ScheduleViewProps } from '../hooks/useScheduleState'
import { monthCells, viewQueryRange, weekDays } from '../domain/scheduleRange'
import { koreanHolidayName, scheduleDayTone, type ScheduleHolidayMode } from '../domain/koreanHolidays'
import { groupListTasks, groupMonthTasks, isOverdueTask, sortScheduleTasks, tasksOnDate } from '../domain/scheduleTasks'
import {
  eventClock,
  eventCoversDate,
  eventEndDay,
  eventHour,
  eventStartDay,
  sortScheduleEvents,
} from '../domain/scheduleEventTime'

const WEEKDAY_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 24 }, (_, index) => index)
const MONTH_CELL_LIMIT = 3

export function ScheduleSourceBadge({ event }: { event: ScheduleEvent }) {
  const key = scheduleFilterKeyOf(event)
  return <span className={`schedule-page__badge schedule-page__badge--${key}`}>{event.origin === 'onefc' ? 'ONE FC 일정' : SCHEDULE_FILTER_LABEL[key]}</span>
}

function eventButtonClass(base: string, event: ScheduleEvent): string {
  return `${base} ${base}--${scheduleFilterKeyOf(event)}`
}

export function ScheduleTaskBadge({ task }: { task: ScheduleTask }) {
  return <span className={`schedule-page__badge schedule-page__badge--${task.source}`}>{SCHEDULE_FILTER_LABEL[task.source]}</span>
}

/** 할 일 표시: ○ 열림 / ✓ 완료. 일정과 구분되도록 테두리형 칩. */
function taskMark(task: ScheduleTask): string {
  return task.status === 'completed' ? '✓' : '○'
}

function taskButtonClass(base: string, task: ScheduleTask, today?: string): string {
  const classes = [base, `${base}--task`, `${base}--${task.source}`]
  if (task.status === 'completed') classes.push(`${base}--done`)
  if (today && isOverdueTask(task, today)) classes.push(`${base}--overdue`)
  return classes.join(' ')
}

/** PC 달력 칸 전용: 할 일 출처 표시(작은 글자). Google 할 일 "G", ONE FC 할 일 "FC". */
const TASK_SOURCE_TAG: Record<ScheduleTask['source'], string> = { google_task: 'G', onefc_todo: 'FC' }

function TaskChip({ task, base, today, onOpenTask, sourceTag = false }: { task: ScheduleTask; base: string; today?: string; onOpenTask: (task: ScheduleTask) => void; sourceTag?: boolean }) {
  return (
    <button
      type="button"
      className={taskButtonClass(base, task, today)}
      title={`${SCHEDULE_FILTER_LABEL[task.source]} · 할 일 · ${task.title}${task.status === 'completed' ? ' (완료)' : ''}`}
      onClick={() => onOpenTask(task)}
    >
      {sourceTag ? (
        <span className={`schedule-page__src-tag schedule-page__src-tag--${task.source}`} aria-label={SCHEDULE_FILTER_LABEL[task.source]}>
          {TASK_SOURCE_TAG[task.source]}
        </span>
      ) : null}
      <span className="schedule-page__task-mark" aria-hidden="true">{taskMark(task)}</span> {task.title}
    </button>
  )
}

type MonthProps = Pick<ScheduleViewProps, 'anchor' | 'today' | 'events' | 'tasks' | 'selectedDate' | 'onSelectDate' | 'onOpenDay' | 'onOpenEvent' | 'onOpenTask'> & {
  /** PC 전용: 일/공휴일 빨강·토 파랑. 없으면(모바일) 기존 표시 그대로. */
  holidayMode?: ScheduleHolidayMode
  /** PC 전용: 칸 빈 곳 클릭으로 날짜 선택, 할 일 출처 표시. 없으면(모바일) 기존 그대로. */
  pcCell?: boolean
}

const WEEKDAY_TONE = ['sun', '', '', '', '', '', 'sat']

export function ScheduleMonth({ anchor, today, events, tasks, selectedDate, onSelectDate, onOpenDay, onOpenEvent, onOpenTask, holidayMode, pcCell = false }: MonthProps) {
  const sorted = sortScheduleEvents(events)
  // 예정일 없는 할 일은 월간 칸에 올리지 않는다(목록 화면 "날짜 없음"에서 보인다).
  const datedTasks = sortScheduleTasks(tasks.filter((task) => task.dueDate))
  const selectedEvents = selectedDate ? sorted.filter((event) => eventCoversDate(event, selectedDate)) : []
  const selectedTasks = selectedDate ? tasksOnDate(datedTasks, selectedDate) : []
  const grid = (
      <div className="schedule-page__month" role="grid" aria-label="월간 일정">
        {WEEKDAY_SUN_FIRST.map((label, index) => (
          <span
            key={label}
            className={holidayMode && WEEKDAY_TONE[index] ? `schedule-page__weekday schedule-page__weekday--${WEEKDAY_TONE[index]}` : 'schedule-page__weekday'}
            role="columnheader"
          >
            {label}
          </span>
        ))}
        {monthCells(anchor).map((cell) => {
          const dayEvents = sorted.filter((event) => eventCoversDate(event, cell.date))
          const dayTasks = tasksOnDate(datedTasks, cell.date)
          // PC: 3건을 넘으면 2건 + "+N" 으로 칸 높이를 고정한다(달력을 늘리지 않음).
          const total = dayEvents.length + dayTasks.length
          const limit = pcCell && total > MONTH_CELL_LIMIT ? MONTH_CELL_LIMIT - 1 : MONTH_CELL_LIMIT
          const visible = dayEvents.slice(0, limit)
          const visibleTasks = dayTasks.slice(0, Math.max(0, limit - visible.length))
          const overflow = dayEvents.length + dayTasks.length - visible.length - visibleTasks.length
          const classes = ['schedule-page__cell']
          if (!cell.inMonth) classes.push('schedule-page__cell--muted')
          if (cell.date === today) classes.push('schedule-page__cell--today')
          if (cell.date === selectedDate) classes.push('schedule-page__cell--selected')
          const tone = holidayMode ? scheduleDayTone(cell.date, holidayMode) : ''
          const holidayName = holidayMode ? koreanHolidayName(cell.date, holidayMode) : ''
          if (tone) classes.push(`schedule-page__cell--${tone}`)
          return (
            <div
              key={cell.date}
              className={classes.join(' ')}
              role="gridcell"
              // PC: 칸의 빈 곳을 눌러도 그 날짜를 고른다. 일정·할 일·+N·날짜 버튼은 각자 동작만 한다(중복 처리 없음).
              onClick={pcCell ? (clickEvent) => {
                if ((clickEvent.target as HTMLElement).closest('button')) return
                if (cell.date !== selectedDate) onSelectDate(cell.date)
              } : undefined}
            >
              <button
                type="button"
                className="schedule-page__date"
                aria-label={`${formatDateWithKoreanWeekday(cell.date)}${holidayName ? ` ${holidayName}` : ''} 일정 ${dayEvents.length}건${dayTasks.length > 0 ? `, 할 일 ${dayTasks.length}건` : ''}`}
                aria-pressed={cell.date === selectedDate}
                onClick={() => onSelectDate(cell.date)}
              >
                {Number(cell.date.slice(8))}
              </button>
              {holidayName ? <span className="schedule-page__holiday-name">{holidayName}</span> : null}
              {visible.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={eventButtonClass('schedule-page__chip', event)}
                  title={`${event.origin === 'onefc' ? 'ONE FC 일정' : SCHEDULE_FILTER_LABEL[scheduleFilterKeyOf(event)]} · ${event.title}`}
                  onClick={() => onOpenEvent(event)}
                >
                  {event.title}
                </button>
              ))}
              {visibleTasks.map((task) => (
                <TaskChip key={task.id} task={task} base="schedule-page__chip" today={today} onOpenTask={onOpenTask} sourceTag={pcCell} />
              ))}
              {overflow > 0 ? (
                <button
                  type="button"
                  className="schedule-page__more"
                  aria-label={pcCell ? `${formatDateWithKoreanWeekday(cell.date)} 항목 ${overflow}건 더 보기` : undefined}
                  onClick={() => {
                    // PC: 이미 선택된 날이면 선택을 풀지 않는다(오른쪽 목록에서 전체 확인).
                    if (pcCell && cell.date === selectedDate) return
                    onSelectDate(cell.date)
                  }}
                >
                  {pcCell ? `+${overflow}건` : `+${overflow}`}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
  )
  if (pcCell) {
    // PC: 왼쪽 달력 · 오른쪽 선택 날짜 세로 목록. 날짜를 골라도 달력 높이는 그대로다.
    return (
      <div className="schedule-page__month-split">
        {grid}
        <section className="schedule-page__day-panel schedule-page__day-side" aria-label={selectedDate ? `${formatDateWithKoreanWeekday(selectedDate)} 일정` : '선택한 날짜 일정'}>
          {selectedDate ? (
            <>
              <div className="schedule-page__day-panel-head">
                <strong>{formatDateWithKoreanWeekday(selectedDate)}</strong>
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenDay(selectedDate)}>일간 보기</Button>
              </div>
              <div className="schedule-page__day-side-body">
                {selectedTasks.length > 0 ? (
                  <ScheduleTaskSection title="할 일" tasks={selectedTasks} today={today} onOpenTask={onOpenTask} showDate={false} compactRows />
                ) : null}
                <ScheduleDayList events={selectedEvents} onOpenEvent={onOpenEvent} detailed={false} showDate={false} />
              </div>
            </>
          ) : <p className="schedule-page__empty">날짜를 선택하면 일정이 여기에 표시됩니다.</p>}
        </section>
      </div>
    )
  }
  return (
    <>
      {grid}
      {selectedDate ? (
        <section className="schedule-page__day-panel" aria-label={`${formatDateWithKoreanWeekday(selectedDate)} 일정`}>
          <div className="schedule-page__day-panel-head">
            <strong>{formatDateWithKoreanWeekday(selectedDate)}</strong>
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenDay(selectedDate)}>일간 보기</Button>
          </div>
          {selectedTasks.length > 0 ? (
            <ScheduleTaskSection title="할 일" tasks={selectedTasks} today={today} onOpenTask={onOpenTask} showDate={false} />
          ) : null}
          <ScheduleDayList events={selectedEvents} onOpenEvent={onOpenEvent} detailed={false} showDate={false} />
        </section>
      ) : null}
    </>
  )
}

export function ScheduleWeek({ anchor, today, events, tasks, onOpenEvent, onOpenTask, holidayMode, pcCell = false }: Pick<ScheduleViewProps, 'anchor' | 'today' | 'events' | 'tasks' | 'onOpenEvent' | 'onOpenTask'> & { holidayMode?: ScheduleHolidayMode; pcCell?: boolean }) {
  const days = weekDays(anchor)
  const sorted = sortScheduleEvents(events)
  const sortedTasks = sortScheduleTasks(tasks)
  return (
    <div className="schedule-page__week" aria-label="주간 일정">
      <div className="schedule-page__week-grid">
        <div className="schedule-page__week-head">
          <span />
          {days.map((date, index) => (
            <strong
              key={date}
              className={[
                'schedule-page__week-day',
                date === today ? 'schedule-page__week-day--today' : '',
                holidayMode && scheduleDayTone(date, holidayMode) ? `schedule-page__week-day--${scheduleDayTone(date, holidayMode)}` : '',
              ].filter(Boolean).join(' ')}
            >
              {WEEKDAY_SUN_FIRST[index]} {Number(date.slice(8))}
              {holidayMode && koreanHolidayName(date, holidayMode) ? <span className="schedule-page__holiday-name"> {koreanHolidayName(date, holidayMode)}</span> : null}
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
        {/* 할 일은 시간 축에 올리지 않는다(시간을 지어내지 않음). 종일 영역처럼 위쪽 한 줄. */}
        <div className="schedule-page__all-day schedule-page__task-row" aria-label="할 일">
          <span className="schedule-page__axis">할 일</span>
          {days.map((date) => (
            <div key={date} className="schedule-page__slot">
              {tasksOnDate(sortedTasks, date).map((task) => (
                <TaskChip key={task.id} task={task} base="schedule-page__block" today={today} onOpenTask={onOpenTask} sourceTag={pcCell} />
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

/** 할 일(Todo)은 날짜만 표시한다(시간 개념 없음). 일정(Event) 시간 표시와 무관. */
function taskDueLabel(task: Pick<ScheduleTask, 'dueDate'>): string {
  if (!task.dueDate) return '날짜 없음'
  return formatDateWithKoreanWeekday(task.dueDate)
}

/** 할 일 묶음(일간·목록·월간 날짜 패널). 조회만 하고 순서·상태를 바꾸지 않는다. */
export function ScheduleTaskSection({ title, tasks, today, onOpenTask, showDate = true, emptyText, compactRows = false }: {
  /** PC: 출처는 배지 한 번만(목록 이름은 상세에서), 제목과 같은 메모는 숨김. */
  compactRows?: boolean
  title: string
  tasks: ScheduleTask[]
  today: string
  onOpenTask: (task: ScheduleTask) => void
  showDate?: boolean
  emptyText?: string
}) {
  if (tasks.length === 0 && !emptyText) {
    return null
  }
  return (
    <section className="schedule-page__task-section" aria-label={title}>
      <h2 className="schedule-page__section-title">{title}</h2>
      {tasks.length === 0 ? <p className="schedule-page__empty">{emptyText}</p> : (
        <ul className="schedule-page__day-list schedule-page__task-list">
          {tasks.map((task) => (
            <li key={task.id} className={taskButtonClass('schedule-page__task-item', task, today)}>
              <button type="button" onClick={() => onOpenTask(task)}>
                <span className="schedule-page__task-mark" aria-hidden="true">{taskMark(task)}</span>
                {showDate ? <span className="schedule-page__row-time">{taskDueLabel(task)}</span> : null}
                <strong className="schedule-page__row-title">{task.title}</strong>
                <ScheduleTaskBadge task={task} />
                {task.status === 'completed' ? <span className="schedule-page__row-meta">완료</span> : null}
                {isOverdueTask(task, today) ? <span className="schedule-page__row-meta schedule-page__row-overdue">지남</span> : null}
                {!compactRows && task.taskListName ? <span className="schedule-page__row-meta">{task.taskListName}</span> : null}
                {task.customerName ? <span className="schedule-page__row-meta">{task.customerName}</span> : null}
                {task.notes && !(compactRows && task.notes.trim() === task.title.trim()) ? <span className="schedule-page__row-desc">{task.notes}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 일간: 시간 없는 할 일 묶음을 시간 일정과 따로 위에 둔다. */
export function ScheduleDay({ anchor, today, events, tasks, onOpenEvent, onOpenTask }: Pick<ScheduleViewProps, 'anchor' | 'today' | 'events' | 'tasks' | 'onOpenEvent' | 'onOpenTask'>) {
  return (
    <>
      <ScheduleTaskSection title="할 일" tasks={tasksOnDate(sortScheduleTasks(tasks), anchor)} today={today} onOpenTask={onOpenTask} showDate={false} />
      <ScheduleDayList events={events} onOpenEvent={onOpenEvent} detailed showDate={false} />
    </>
  )
}

/** 목록: 지난 할 일 → 일정 → 기간 안 할 일 → 날짜 없음.
 * PC(monthOnly): 기본은 조회 월에 마감되는 할 일만. 다른 달의 지난 할 일은 "지난 할 일 전체" 필터를 켰을 때만. */
export function ScheduleList({ anchor, today, events, tasks, onOpenEvent, onOpenTask, monthOnly = false, includeOverdue = false }: Pick<ScheduleViewProps, 'anchor' | 'today' | 'events' | 'tasks' | 'onOpenEvent' | 'onOpenTask'> & { monthOnly?: boolean; includeOverdue?: boolean }) {
  const range = viewQueryRange('list', anchor)
  if (monthOnly) {
    const monthTasks = groupMonthTasks(tasks, range)
    const [year, month] = anchor.split('-').map(Number)
    const overdueOther = includeOverdue ? groupListTasks(tasks, range, today).overdue.filter((task) => !monthTasks.includes(task)) : []
    return (
      <>
        {includeOverdue ? (
          <ScheduleTaskSection title="다른 달의 지난 할 일 (미완료)" tasks={overdueOther} today={today} onOpenTask={onOpenTask} compactRows emptyText="다른 달의 지난 할 일이 없습니다." />
        ) : null}
        <ScheduleDayList events={events} onOpenEvent={onOpenEvent} detailed showDate />
        <ScheduleTaskSection title={`${year}년 ${month}월 마감 할 일`} tasks={monthTasks} today={today} onOpenTask={onOpenTask} compactRows emptyText="이 달에 마감되는 할 일이 없습니다." />
        <ScheduleTaskSection title="날짜 없음" tasks={groupListTasks(tasks, range, today).undated} today={today} onOpenTask={onOpenTask} compactRows />
      </>
    )
  }
  const groups = groupListTasks(tasks, range, today)
  return (
    <>
      <ScheduleTaskSection title="지난 할 일" tasks={groups.overdue} today={today} onOpenTask={onOpenTask} />
      <ScheduleDayList events={events} onOpenEvent={onOpenEvent} detailed showDate />
      <ScheduleTaskSection title="할 일" tasks={groups.dated} today={today} onOpenTask={onOpenTask} />
      <ScheduleTaskSection title="날짜 없음" tasks={groups.undated} today={today} onOpenTask={onOpenTask} />
    </>
  )
}

/** 할 일 읽기 전용 상세. 편집 UI 없음. ONE FC 할 일은 할 일 화면으로만 이동한다. */
export function ScheduleTaskDetailDialog({ taskDetail, today, onCloseTaskDetail, onOpenTodos, actions, writable }: Pick<ScheduleViewProps, 'taskDetail' | 'today' | 'onCloseTaskDetail' | 'onOpenTodos'> & { actions?: ReactNode; writable?: boolean }) {
  if (!taskDetail) {
    return null
  }
  const isGoogle = taskDetail.source === 'google_task'
  return (
    <FormDialog
      open
      title={taskDetail.title}
      closeOnBackdrop
      closeOnEsc
      onClose={onCloseTaskDetail}
      footer={(
        <div className="schedule-page__dialog-actions">
          {!isGoogle ? (
            <FormButton htmlType="button" variant="secondary" onClick={onOpenTodos}>할 일 화면에서 보기</FormButton>
          ) : null}
          {actions}
          <FormButton htmlType="button" variant="secondary" onClick={onCloseTaskDetail}>닫기</FormButton>
        </div>
      )}
    >
      <dl className="schedule-page__detail">
        {isGoogle ? <div><dt>목록</dt><dd>{taskDetail.taskListName || '내 할 일 목록'}</dd></div> : null}
        <div><dt>날짜</dt><dd>{taskDueLabel(taskDetail)}{isOverdueTask(taskDetail, today) ? ' (지남)' : ''}</dd></div>
        <div><dt>상태</dt><dd>{taskDetail.status === 'completed' ? '완료' : '진행 중'}</dd></div>
        {taskDetail.customerName ? <div><dt>고객</dt><dd>{taskDetail.customerName}</dd></div> : null}
        {taskDetail.notes ? <div><dt>메모</dt><dd className="schedule-page__detail-desc">{taskDetail.notes}</dd></div> : null}
        <div>
          <dt>출처</dt>
          <dd><ScheduleTaskBadge task={taskDetail} /> {isGoogle ? (writable ? 'Google 할 일' : 'Google 출처 · 읽기 전용') : 'ONE FC 할 일'}</dd>
        </div>
      </dl>
    </FormDialog>
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
export function ScheduleGoogleDetailDialog({ detail, onCloseDetail, actions }: Pick<ScheduleViewProps, 'detail' | 'onCloseDetail'> & { actions?: ReactNode }) {
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
          {actions}
          <FormButton htmlType="button" variant="secondary" onClick={onCloseDetail}>닫기</FormButton>
        </div>
      )}
    >
      <dl className="schedule-page__detail">
        <div><dt>일시</dt><dd>{detailWhen(detail)}</dd></div>
        <div><dt>캘린더</dt><dd>{detail.calendarName || '기본 캘린더'}</dd></div>
        {detail.location ? <div><dt>위치</dt><dd>{detail.location}</dd></div> : null}
        {detail.description ? <div><dt>설명</dt><dd className="schedule-page__detail-desc">{detail.description}</dd></div> : null}
        <div><dt>출처</dt><dd>{detail.origin === 'onefc' ? 'ONE FC 일정' : <><ScheduleSourceBadge event={detail} /> {actions && detail.writable ? '' : '읽기 전용'}</>}</dd></div>
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
