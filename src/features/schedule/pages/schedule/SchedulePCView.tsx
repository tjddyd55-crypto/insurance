import ScheduleChrome from '../../components/ScheduleChrome'
import { ScheduleDayList, ScheduleEventDialog, ScheduleMonth, ScheduleWeek } from '../../components/ScheduleBoards'
import type { ScheduleViewProps } from '../../hooks/useScheduleState'

export default function SchedulePCView(props: ScheduleViewProps) {
  return (
    <main className="page schedule-page schedule-page--pc page--with-back">
      <ScheduleChrome {...props} />
      {props.view === 'month' ? <ScheduleMonth anchor={props.anchor} events={props.events} onSelectDate={props.onSelectDate} onOpenEvent={props.onOpenEvent} /> : null}
      {props.view === 'week' ? <ScheduleWeek anchor={props.anchor} events={props.events} onOpenEvent={props.onOpenEvent} /> : null}
      {props.view === 'day' || props.view === 'list' ? (
        <ScheduleDayList events={props.events} onOpenEvent={props.onOpenEvent} detailed={props.view === 'day'} />
      ) : null}
      <ScheduleEventDialog {...props} />
    </main>
  )
}
