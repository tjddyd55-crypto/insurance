import type { ScheduleViewProps } from '../../hooks/useScheduleState'
import ScheduleBody from './ScheduleBody'

export default function SchedulePCView(props: ScheduleViewProps) {
  return (
    <main className="page schedule-page schedule-page--pc page--with-back">
      <ScheduleBody {...props} />
    </main>
  )
}
