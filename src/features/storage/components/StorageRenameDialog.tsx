import { FormButton, FormInput } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { CustomerWorkspaceMobileScope } from '../../customers/components/CustomerWorkspaceActionButtons'
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
  /** 고객 작업영역 모바일 — 메모/상담과 동일 footer 버튼 */
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

  const formBody = (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FormInput value={value} onChange={(event) => onChange(event.target.value)} maxLength={120} autoFocus />
      {useWorkspaceFooter ? (
        <CustomerWorkspaceFormModalFooter
          onCancel={onClose}
          onSave={onSubmit}
          busy={loading}
          saveDisabled={!value.trim()}
        />
      ) : (
        <div className="flex justify-end gap-2 mt-4">
          <FormButton htmlType="button" variant="secondary" onClick={onClose} disabled={loading}>
            취소
          </FormButton>
          <FormButton htmlType="submit" variant="primary" disabled={loading}>
            {loading ? '저장 중…' : '저장'}
          </FormButton>
        </div>
      )}
    </form>
  )

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} panelClassName={panelClassName} closeOnBackdrop={false}>
      {useWorkspaceFooter ? (
        <CustomerWorkspaceMobileScope>
          <div className="text-lg font-semibold mb-3 text-[var(--text-primary)]">{title}</div>
          {formBody}
        </CustomerWorkspaceMobileScope>
      ) : (
        <>
          <div className="text-lg font-semibold mb-3 text-[var(--text-primary)]">{title}</div>
          {formBody}
        </>
      )}
    </Modal>
  )
}
