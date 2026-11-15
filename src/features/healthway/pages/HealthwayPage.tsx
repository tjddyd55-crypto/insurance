import { useCallback } from 'react'
import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import { useParams, useBlocker, useBeforeUnload } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useAuth } from '../../auth/AuthProvider'
import { useHealthwayController } from '../useHealthwayController'
import HealthwayPCView from './healthway/HealthwayPCView'
import HealthwayMobileView from './healthway/HealthwayMobileView'
import '../healthway.css'
function CustomerHealthway({ customerId }: { customerId: number }) {
  const { token } = useAuth(), controller = useHealthwayController(customerId, token)
  const blocker = useBlocker(controller.dirty)
  useBeforeUnload(useCallback((event) => { if (controller.dirty) { event.preventDefault(); event.returnValue = '' } }, [controller.dirty]))
  return <><ResponsiveLayout PC={HealthwayPCView} Mobile={HealthwayMobileView} viewProps={{ controller }} />
    <ConfirmDialog open={blocker.state === 'blocked'} title="요청 설정 변경" message="변경사항이 저장되지 않았습니다. 닫으시겠습니까?" confirmLabel="닫기" onConfirm={() => { if (blocker.state === 'blocked') blocker.proceed() }} onCancel={() => { if (blocker.state === 'blocked') blocker.reset() }} /></>
}
export default function HealthwayPage() {
  const { customerId } = useParams(), { user } = useAuth()
  return <CustomerHealthway key={`${user?.id}:${customerId}`} customerId={Number(customerId)} />
}
