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

/** PC·모바일 웹 공통 본문. 차이는 CSS(.schedule-page--pc / --mobile)만. */
export default function ScheduleBody(props: ScheduleViewProps) {
  return (
    <>
      <ScheduleChrome {...props} />
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
