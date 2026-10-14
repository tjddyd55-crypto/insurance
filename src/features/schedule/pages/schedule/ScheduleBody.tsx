import ScheduleChrome from '../../components/ScheduleChrome'
import {
  ScheduleDay,
  ScheduleEventDialog,
  ScheduleGoogleDetailDialog,
  ScheduleList,
  ScheduleMonth,
  ScheduleTaskDetailDialog,
  ScheduleWeek,
} from '../../components/ScheduleBoards'
import type { ScheduleViewProps } from '../../hooks/useScheduleState'
import ScheduleHolidaySetting, { useScheduleHolidayMode } from '../../components/ScheduleHolidaySetting'

/** PC·모바일 웹 공통 본문. 차이는 CSS(.schedule-page--pc / --mobile)만. */
export default function ScheduleBody(props: ScheduleViewProps & { calendarDecor?: boolean; compact?: boolean }) {
  const [holidayMode, setHolidayMode] = useScheduleHolidayMode(props.userKey)
  const decorMode = props.calendarDecor ? holidayMode : undefined
  return (
    <>
      <ScheduleChrome
        {...props}
        toolbarExtra={props.compact && props.calendarDecor && (props.view === 'month' || props.view === 'week')
          ? <ScheduleHolidaySetting mode={holidayMode} onChange={setHolidayMode} />
          : undefined}
      />
      {!props.compact && props.calendarDecor && (props.view === 'month' || props.view === 'week') ? (
        <ScheduleHolidaySetting mode={holidayMode} onChange={setHolidayMode} />
      ) : null}
      {props.view === 'month' ? (
        <ScheduleMonth
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          selectedDate={props.selectedDate}
          onSelectDate={props.onSelectDate}
          onOpenDay={props.onOpenDay}
          onOpenEvent={props.onOpenEvent}
          onOpenTask={props.onOpenTask}
          holidayMode={decorMode}
        />
      ) : null}
      {props.view === 'week' ? (
        <ScheduleWeek
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          onOpenEvent={props.onOpenEvent}
          onOpenTask={props.onOpenTask}
          holidayMode={decorMode}
        />
      ) : null}
      {props.view === 'day' ? (
        <ScheduleDay
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          onOpenEvent={props.onOpenEvent}
          onOpenTask={props.onOpenTask}
        />
      ) : null}
      {props.view === 'list' ? (
        <ScheduleList
          anchor={props.anchor}
          today={props.today}
          events={props.events}
          tasks={props.tasks}
          onOpenEvent={props.onOpenEvent}
          onOpenTask={props.onOpenTask}
        />
      ) : null}
      <ScheduleGoogleDetailDialog detail={props.detail} onCloseDetail={props.onCloseDetail} />
      <ScheduleTaskDetailDialog
        taskDetail={props.taskDetail}
        today={props.today}
        onCloseTaskDetail={props.onCloseTaskDetail}
        onOpenTodos={props.onOpenTodos}
      />
      <ScheduleEventDialog {...props} />
    </>
  )
}
