import { useCallback } from 'react'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useServiceIntegrationsState, type ServiceIntegrationsViewProps } from '../hooks/useServiceIntegrationsState'
import ServiceIntegrationsMobileView from './service-integrations/ServiceIntegrationsMobileView'
import ServiceIntegrationsPCView from './service-integrations/ServiceIntegrationsPCView'
import '../service-integrations.css'

export default function ServiceIntegrationsPage() {
  const state = useServiceIntegrationsState()
  const { confirm, confirmDialog } = useConfirmDialog()

  const onDisconnect = useCallback<ServiceIntegrationsViewProps['onDisconnect']>(async (provider) => {
    const accepted = await confirm({
      title: '연동 해제',
      message: `${provider.name} 연동을 해제하시겠습니까?`,
      confirmLabel: '해제',
      tone: 'danger',
    })
    if (!accepted) {
      return
    }
    state.onDisconnect(provider)
  }, [confirm, state])

  const viewProps: ServiceIntegrationsViewProps = {
    ...state,
    onDisconnect,
  }

  return (
    <>
      <ResponsiveLayout<ServiceIntegrationsViewProps>
        PC={ServiceIntegrationsPCView}
        Mobile={ServiceIntegrationsMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}
