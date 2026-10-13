import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import type { PersonalBinder, PersonalBinderMaterial } from '../personalBinder.types'
import { BinderPageSelectionEditor } from './BinderPageSelectionEditor'

type Props = {
  open: boolean
  variant: 'desktop' | 'mobile'
  binder: PersonalBinder
  folderLabel: string
  sectionTitle: string
  material: PersonalBinderMaterial | null
  pdfUrl: string | null
  initialSelection: number[] | null
  onClose: () => void
  onComplete: (selection: number[] | null) => void
}

export function BinderPageSelectionDialog({
  open,
  variant,
  binder,
  folderLabel,
  sectionTitle,
  material,
  pdfUrl,
  initialSelection,
  onClose,
  onComplete,
}: Props) {
  if (!open || !material) return null

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      closeOnBackdrop={false}
      closeOnEsc={false}
      usePortal
      panelPreset="largeForm"
      panelClassName="personal-binder-page-dialog"
      overlayClassName="personal-binder-page-dialog-overlay"
      ariaLabel="PDF 페이지 선택"
    >
      <BinderPageSelectionEditor
        active={open}
        variant={variant}
        presentation="modal"
        binder={binder}
        folderLabel={folderLabel}
        sectionTitle={sectionTitle}
        material={material}
        pdfUrl={pdfUrl}
        initialSelection={initialSelection}
        onClose={onClose}
        onComplete={onComplete}
      />
      <div className="personal-binder-page-dialog__modal-close">
        <FormButton variant="action" onClick={onClose}>닫기</FormButton>
      </div>
    </BaseDialog>
  )
}
