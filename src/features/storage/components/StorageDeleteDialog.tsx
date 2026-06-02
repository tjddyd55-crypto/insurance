import { FormButton } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { CustomerWorkspaceFormModalShell } from '../../customers/components/CustomerWorkspaceFormModalShell'
import { CustomerWorkspaceFormModalFooter } from '../../customers/components/CustomerWorkspaceFormModalFooter'
import type { StorageActionVariant } from './StorageFileList'

type StorageDeleteDialogProps = {
  open: boolean
  title: string
  description: string
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
  /** 고객 작업영역 모바일 — 이름 변경 모달과 동일 shell/footer */
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
      <CustomerWorkspaceFormModalShell
        open={open}
        onClose={onClose}
        ariaLabel={title}
        closeOnBackdrop={false}
        usePortal
      >
        <div className="text-lg font-semibold mb-2 text-[var(--text-primary)]">{title}</div>
        <p className="text-sm text-[var(--text-secondary)]">{description}</p>
        <CustomerWorkspaceFormModalFooter
          onCancel={onClose}
          onSave={onConfirm}
          busy={loading}
          saveLabel="삭제"
          busySaveLabel="삭제 중…"
          confirmTone="danger"
        />
      </CustomerWorkspaceFormModalShell>
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
