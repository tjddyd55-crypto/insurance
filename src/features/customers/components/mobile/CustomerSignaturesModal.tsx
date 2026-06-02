import Modal from '../../../../components/ui/Modal'
import CustomerWorkspaceCloseButton from '../CustomerWorkspaceCloseButton'
import ContractSignatureHistoryPage from '../../../contracts/userHistory/ContractSignatureHistoryPage'

type CustomerSignaturesModalProps = {
  customerId: number
  onClose: () => void
}

export default function CustomerSignaturesModal({ customerId, onClose }: CustomerSignaturesModalProps) {
  return (
    <Modal open onClose={onClose} ariaLabel="전자서명" panelClassName="workspace-mobile-outlet-modal">
      <div className="workspace-mobile-outlet-modal__header">
        <span className="workspace-mobile-outlet-modal__spacer" aria-hidden />
        <h2 className="workspace-mobile-outlet-modal__title">전자서명</h2>
        <CustomerWorkspaceCloseButton onClick={onClose} />
      </div>
      <div className="workspace-mobile-outlet-modal__body customer-workspace-mobile-scope customer-signatures-mobile-shell">
        <ContractSignatureHistoryPage workspaceCustomerId={customerId} />
      </div>
    </Modal>
  )
}
