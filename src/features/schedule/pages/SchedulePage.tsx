import { useCallback } from 'react'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useScheduleState, type ScheduleViewProps } from '../hooks/useScheduleState'
import ScheduleMobileView from './schedule/ScheduleMobileView'
import SchedulePCView from './schedule/SchedulePCView'
import '../schedule-page.css'

export default function SchedulePage() {
  const state = useScheduleState()
  const { confirm, confirmDialog } = useConfirmDialog()

  const onCloseEdit = useCallback(async () => {
    if (state.editDirty) {
      const accepted = await confirm({
        title: '닫기',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
        confirmLabel: '닫기',
        cancelLabel: '계속 수정',
      })
      if (!accepted) {
        return
      }
    }
    state.onCloseEdit()
  }, [confirm, state])

  const viewProps: ScheduleViewProps = {
    ...state,
    onCloseEdit: () => {
      void onCloseEdit()
    },
  }

  return (
    <>
      <ResponsiveLayout<ScheduleViewProps>
        PC={SchedulePCView}
        Mobile={ScheduleMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}
