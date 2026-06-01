import { FormButton, FormInput } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import {
  CustomerWorkspaceMobileScope,
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSecondaryActionButton,
} from '../../customers/components/CustomerWorkspaceActionButtons'
import { CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS } from '../../customers/components/CustomerWorkspaceFormModalFooter'
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
  const panelClassName = useWorkspaceFooter
    ? 'max-w-lg w-[92vw] customer-workspace-form-modal'
    : 'max-w-md'

  const saveDisabled = !value.trim()

  const workspaceFooter = (
    <div className={CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS}>
      <CustomerWorkspaceSecondaryActionButton disabled={loading} onClick={onClose}>
        취소
      </CustomerWorkspaceSecondaryActionButton>
      <CustomerWorkspacePrimaryActionButton
        disabled={loading || saveDisabled}
        onClick={() => void onSubmit()}
      >
        {loading ? '저장 중…' : '저장'}
      </CustomerWorkspacePrimaryActionButton>
    </div>
  )

  const storageFooter = (
    <div className="flex justify-end gap-2 mt-4">
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
      onSubmit={(event) => {
        event.preventDefault()
        if (saveDisabled || loading) {
          return
        }
        onSubmit()
      }}
    >
      <FormInput value={value} onChange={(event) => onChange(event.target.value)} maxLength={120} autoFocus />
      {useWorkspaceFooter ? null : storageFooter}
    </form>
  )

  if (useWorkspaceFooter) {
    return (
      <Modal open={open} onClose={onClose} ariaLabel={title} panelClassName={panelClassName} closeOnBackdrop={false}>
        <CustomerWorkspaceMobileScope>
          <div className="text-lg font-semibold mb-3 text-[var(--text-primary)]">{title}</div>
          {formBody}
          {workspaceFooter}
        </CustomerWorkspaceMobileScope>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} panelClassName={panelClassName} closeOnBackdrop={false}>
      <div className="text-lg font-semibold mb-3 text-[var(--text-primary)]">{title}</div>
      {formBody}
    </Modal>
  )
}
