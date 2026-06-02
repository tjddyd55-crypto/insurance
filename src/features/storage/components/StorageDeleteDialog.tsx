import { FormButton } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import {
  CustomerWorkspaceDangerActionButton,
  CustomerWorkspaceMobileScope,
  CustomerWorkspaceSecondaryActionButton,
} from '../../customers/components/CustomerWorkspaceActionButtons'
import { CUSTOMER_WORKSPACE_FORM_MODAL_PANEL_CLASS } from '../../customers/components/CustomerWorkspaceFormModalShell'
import { CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS } from '../../customers/components/CustomerWorkspaceFormModalFooter'
import type { StorageActionVariant } from './StorageFileList'

type StorageDeleteDialogProps = {
  open: boolean
  title: string
  description: string
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
  /** 고객 작업영역 모바일 — 이름 변경 모달과 동일 footer DOM (inline, portal 없음) */
  footerVariant?: StorageActionVariant
}

/**
 * workspace 삭제 확인: 이름 변경(fd9293f)과 동일하게 inline Modal + 직접 footer 버튼.
 * portal/shell 경로는 outlet 중첩 시 삭제 모달 footer만 cascade가 깨지는 실기기 회귀가 있어 사용하지 않는다.
 */
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

  const workspaceFooter = (
    <div className={CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS}>
      <CustomerWorkspaceSecondaryActionButton disabled={loading} onClick={onClose}>
        취소
      </CustomerWorkspaceSecondaryActionButton>
      <CustomerWorkspaceDangerActionButton disabled={loading} onClick={onConfirm}>
        {loading ? '삭제 중…' : '삭제'}
      </CustomerWorkspaceDangerActionButton>
    </div>
  )

  if (useWorkspaceFooter) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        ariaLabel={title}
        panelClassName={`${CUSTOMER_WORKSPACE_FORM_MODAL_PANEL_CLASS} customer-workspace-delete-form-modal`}
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
    <Modal open={open} onClose={onClose} ariaLabel={title} panelClassName="max-w-md" closeOnBackdrop={false}>
      <div className="text-lg font-semibold mb-2 text-[var(--text-primary)]">{title}</div>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      {storageFooter}
    </Modal>
  )
}
