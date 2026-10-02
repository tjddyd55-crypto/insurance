import ScheduleChrome from '../../components/ScheduleChrome'
import {
  ScheduleDayList,
  ScheduleEventDialog,
  ScheduleGoogleDetailDialog,
  ScheduleMonth,
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
          selectedDate={props.selectedDate}
          onSelectDate={props.onSelectDate}
          onOpenDay={props.onOpenDay}
          onOpenEvent={props.onOpenEvent}
        />
      ) : null}
      {props.view === 'week' ? (
        <ScheduleWeek anchor={props.anchor} today={props.today} events={props.events} onOpenEvent={props.onOpenEvent} />
      ) : null}
      {props.view === 'day' || props.view === 'list' ? (
        <ScheduleDayList events={props.events} onOpenEvent={props.onOpenEvent} detailed showDate={props.view === 'list'} />
      ) : null}
      <ScheduleGoogleDetailDialog detail={props.detail} onCloseDetail={props.onCloseDetail} />
      <ScheduleEventDialog {...props} />
    </>
  )
}
