import { FormButton, FormInput } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import {
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSecondaryActionButton,
} from '../../customers/components/CustomerWorkspaceActionButtons'
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
  /** 폴더 생성 모달 전용 여백·입력칸 레이아웃 */
  folderCreate?: boolean
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
  folderCreate = false,
}: StorageRenameDialogProps) {
  const useWorkspaceFooter = footerVariant === 'workspace'
  const saveDisabled = !value.trim()
  const folderCreatePanelClass = folderCreate ? 'file-folder-create-modal' : ''
  const headerClass = folderCreate
    ? 'file-folder-create-modal__header'
    : 'customer-workspace-form-modal__header'
  const titleClass = folderCreate
    ? 'file-folder-create-modal__title'
    : 'customer-workspace-form-modal__title'
  const bodyClass = folderCreate ? 'file-folder-create-modal__body' : 'customer-workspace-form-modal__body'

  if (folderCreate) {
    const folderCreateForm = (
      <form
        className="file-folder-create-modal__body"
        onSubmit={(event) => {
          event.preventDefault()
          if (saveDisabled || loading) {
            return
          }
          onSubmit()
        }}
      >
        <div className="file-folder-create-modal__field">
          <FormInput
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={120}
            autoFocus
          />
        </div>
        {useWorkspaceFooter ? (
          <div className="file-folder-create-modal__actions customer-workspace-modal-actions user-modal-actions">
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
        ) : (
          <div className="file-folder-create-modal__actions user-modal-actions">
            <FormButton htmlType="button" variant="secondary" onClick={onClose} disabled={loading}>
              취소
            </FormButton>
            <FormButton htmlType="submit" variant="primary" disabled={loading || saveDisabled}>
              {loading ? '저장 중…' : '저장'}
            </FormButton>
          </div>
        )}
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
          panelClassExtra={folderCreatePanelClass}
        >
          <header className={headerClass}>
            <h2 className={titleClass}>{title}</h2>
          </header>
          {folderCreateForm}
        </CustomerWorkspaceFormModalShell>
      )
    }

    return (
      <Modal
        open={open}
        onClose={onClose}
        ariaLabel={title}
        panelClassName={folderCreatePanelClass}
        closeOnBackdrop={false}
      >
        <header className={headerClass}>
          <h2 className={titleClass}>{title}</h2>
        </header>
        {folderCreateForm}
      </Modal>
    )
  }

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
        panelClassExtra={folderCreatePanelClass}
      >
        <header className={headerClass}>
          <h2 className={titleClass}>{title}</h2>
        </header>
        <div className={bodyClass}>{formBody}</div>
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
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={title}
      panelClassName={['max-w-md', folderCreatePanelClass].filter(Boolean).join(' ')}
      closeOnBackdrop={false}
    >
      <header className={headerClass}>
        <h2 className={titleClass}>{title}</h2>
      </header>
      <div className={bodyClass}>{formBody}</div>
    </Modal>
  )
}
