import Modal from '../../../../components/ui/Modal'
import { EmptyState, LoadingState } from '../../../../components/feedback'
import CustomerWorkspaceCloseButton from '../CustomerWorkspaceCloseButton'
import { useGaSettings } from '../../../ga-settings/useGaSettings'
import CustomerGaExcelPageMobile from '../../pages/detail/CustomerGaExcelPageMobile'

type CustomerGaDataModalProps = {
  customerId: number
  onClose: () => void
}

export default function CustomerGaDataModal({ customerId, onClose }: CustomerGaDataModalProps) {
  const { gaSettings, loading: gaSettingsLoading } = useGaSettings()

  return (
    <Modal open onClose={onClose} ariaLabel="GA 데이터" panelClassName="workspace-mobile-outlet-modal">
      <div className="workspace-mobile-outlet-modal__header">
        <span className="workspace-mobile-outlet-modal__spacer" aria-hidden />
        <h2 className="workspace-mobile-outlet-modal__title">GA 데이터</h2>
        <CustomerWorkspaceCloseButton onClick={onClose} />
      </div>
      <div className="workspace-mobile-outlet-modal__body">
        {gaSettingsLoading ? (
          <LoadingState message="권한 확인 중…" />
        ) : !gaSettings.use_ga_excel ? (
          <EmptyState message="GA 데이터 보기 권한이 비활성화되어 있습니다." />
        ) : (
          <CustomerGaExcelPageMobile routeCustomerId={customerId} />
        )}
      </div>
    </Modal>
  )
}
