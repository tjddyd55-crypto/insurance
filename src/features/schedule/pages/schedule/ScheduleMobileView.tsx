import type { ScheduleViewProps } from '../../hooks/useScheduleState'
import ScheduleBody from './ScheduleBody'

export default function ScheduleMobileView(props: ScheduleViewProps) {
  return (
    <main className="page schedule-page schedule-page--mobile page--with-back">
      <ScheduleBody {...props} />
    </main>
  )
}
