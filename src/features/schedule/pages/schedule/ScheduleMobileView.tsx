import type { CSSProperties } from 'react'
import { scheduleItemCssVariables, SCHEDULE_COMPLETED_OPACITY } from '../../scheduleItemColors'
import type { ScheduleViewProps } from '../../hooks/useScheduleState'
import ScheduleBody from './ScheduleBody'

export default function ScheduleMobileView(props: ScheduleViewProps) {
  return (
    <main style={{ ...scheduleItemCssVariables({ source: 'onefc_todo' }), '--schedule-completed-opacity': String(SCHEDULE_COMPLETED_OPACITY) } as CSSProperties} className="page schedule-page schedule-page--mobile page--with-back">
      <ScheduleBody {...props} />
    </main>
  )
}
