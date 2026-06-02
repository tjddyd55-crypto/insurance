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
      <CustomerWorkspaceFormModalShell
        open={open}
        onClose={onClose}
        ariaLabel={title}
        closeOnBackdrop={false}
        usePortal
      >
        <div className="text-lg font-semibold mb-3 text-[var(--text-primary)]">{title}</div>
        {formBody}
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
      <div className="text-lg font-semibold mb-3 text-[var(--text-primary)]">{title}</div>
      {formBody}
    </Modal>
  )
}
