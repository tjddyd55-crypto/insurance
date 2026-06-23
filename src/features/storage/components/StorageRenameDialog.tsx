import { FormButton, FormInput } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { CustomerWorkspaceFormModalShell } from '../../customers/components/CustomerWorkspaceFormModalShell'
import { CustomerWorkspaceFormModalFooter } from '../../customers/components/CustomerWorkspaceFormModalFooter'
import type { StorageActionVariant } from './StorageFileList'

type StorageRenameDialogProps = {
  open: boolean
  title: string
  value: string
  loading?: boolean
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
  /** 고객 작업영역 모바일 — 메모/상담·폴더 삭제 모달과 동일 footer 버튼 */
  footerVariant?: StorageActionVariant
}

export default function StorageRenameDialog({
  open,
  title,
  value,
  loading = false,
  onChange,
  onClose,
  onSubmit,
  footerVariant = 'storage',
}: StorageRenameDialogProps) {
  const useWorkspaceFooter = footerVariant === 'workspace'
  const saveDisabled = !value.trim()

  const storageFooter = (
    <div className="user-modal-actions">
      <FormButton htmlType="button" variant="secondary" onClick={onClose} disabled={loading}>
        취소
      </FormButton>
      <FormButton htmlType="submit" variant="primary" disabled={loading || saveDisabled}>
        {loading ? '저장 중…' : '저장'}
      </FormButton>
    </div>
  )

  const formBody = (
    <form
      className={useWorkspaceFooter ? 'customer-workspace-form-modal__form' : undefined}
      onSubmit={(event) => {
        event.preventDefault()
        if (saveDisabled || loading) {
          return
        }
        onSubmit()
      }}
    >
      <FormInput
        className={useWorkspaceFooter ? 'customer-workspace-form-modal__input' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={120}
        autoFocus
      />
      {useWorkspaceFooter ? null : storageFooter}
    </form>
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
        <header className="customer-workspace-form-modal__header">
          <h2 className="customer-workspace-form-modal__title">{title}</h2>
        </header>
        <div className="customer-workspace-form-modal__body">{formBody}</div>
        <CustomerWorkspaceFormModalFooter
          onCancel={onClose}
          onSave={onSubmit}
          busy={loading}
          saveDisabled={saveDisabled}
        />
      </CustomerWorkspaceFormModalShell>
    )
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} panelClassName="max-w-md" closeOnBackdrop={false}>
      <header className="customer-workspace-form-modal__header">
        <h2 className="customer-workspace-form-modal__title">{title}</h2>
      </header>
      <div className="customer-workspace-form-modal__body">{formBody}</div>
    </Modal>
  )
}
