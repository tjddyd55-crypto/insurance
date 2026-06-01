import Modal from '../../../components/ui/Modal'
import { FormButton } from '../../../components/form'
import {
  CustomerWorkspaceMobileScope,
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSecondaryActionButton,
} from '../../customers/components/CustomerWorkspaceActionButtons'
import { CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS } from '../../customers/components/CustomerWorkspaceFormModalFooter'
import type { StorageActionVariant } from './StorageFileList'

type StorageDeleteDialogProps = {
  open: boolean
  title: string
  description: string
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
  /** 고객 작업영역 모바일 — 메모/상담·폴더 생성 모달과 동일 footer 버튼 */
  footerVariant?: StorageActionVariant
}

export default function StorageDeleteDialog({
  open,
  title,
  description,
  loading = false,
  onClose,
  onConfirm,
  footerVariant = 'storage',
}: StorageDeleteDialogProps) {
  const useWorkspaceFooter = footerVariant === 'workspace'
  const panelClassName = useWorkspaceFooter
    ? 'max-w-lg w-[92vw] customer-workspace-form-modal'
    : 'max-w-md'

  const workspaceFooter = (
    <div className={CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS}>
      <CustomerWorkspaceSecondaryActionButton disabled={loading} onClick={onClose}>
        취소
      </CustomerWorkspaceSecondaryActionButton>
      <CustomerWorkspacePrimaryActionButton disabled={loading} onClick={onConfirm}>
        {loading ? '처리 중…' : '확인'}
      </CustomerWorkspacePrimaryActionButton>
    </div>
  )

  const storageFooter = (
    <div className="flex justify-end gap-2 mt-4">
      <FormButton htmlType="button" variant="secondary" onClick={onClose} disabled={loading}>
        취소
      </FormButton>
      <FormButton htmlType="button" variant="primary" onClick={onConfirm} disabled={loading}>
        {loading ? '처리 중…' : '확인'}
      </FormButton>
    </div>
  )

  if (useWorkspaceFooter) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        ariaLabel={title}
        panelClassName={panelClassName}
        closeOnBackdrop={false}
      >
        <CustomerWorkspaceMobileScope>
          <div className="text-lg font-semibold mb-2 text-[var(--text-primary)]">{title}</div>
          <p className="text-sm text-[var(--text-secondary)]">{description}</p>
          {workspaceFooter}
        </CustomerWorkspaceMobileScope>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} panelClassName={panelClassName} closeOnBackdrop={false}>
      <div className="text-lg font-semibold mb-2 text-[var(--text-primary)]">{title}</div>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      {storageFooter}
    </Modal>
  )
}
