import Modal from '../../../../components/ui/Modal'
import { CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS } from '../CustomerWorkspaceActionButtons'
import CustomerWorkspaceCloseButton from '../CustomerWorkspaceCloseButton'
import { useAuth } from '../../../auth/AuthProvider'
import StorageWorkspace from '../../../storage/components/StorageWorkspace'

type CustomerFilesModalProps = {
  customerId: number
  onClose: () => void
}

export default function CustomerFilesModal({ customerId, onClose }: CustomerFilesModalProps) {
  const { token } = useAuth()

  return (
    <Modal open onClose={onClose} ariaLabel="고객 파일" panelClassName="workspace-mobile-outlet-modal">
      <div className="workspace-mobile-outlet-modal__header">
        <span className="workspace-mobile-outlet-modal__spacer" aria-hidden />
        <h2 className="workspace-mobile-outlet-modal__title">고객 파일</h2>
        <CustomerWorkspaceCloseButton onClick={onClose} />
      </div>
      <div className="workspace-mobile-outlet-modal__body">
        <div className={`customer-files-mobile-shell ${CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS}`}>
          {token?.trim() ? (
            <StorageWorkspace
              token={token}
              customerId={customerId}
              title=""
              subtitle={undefined}
              variant="mobile"
              actionVariant="workspace"
            />
          ) : (
            <div style={{ padding: 16 }}>로그인이 필요합니다.</div>
          )}
        </div>
      </div>
    </Modal>
  )
}
