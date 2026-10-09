import { CoverageSimulatorNameCreateDialog } from './CoverageSimulatorNameCreateDialog'

type Props = {
  open: boolean
  initialTitle: string
  dialogTitle?: string
  validationError?: string | null
  saving?: boolean
  onClose: () => void
  onConfirm: (title: string) => void | Promise<void>
}

/** 시뮬레이션 제목 저장 — `CoverageSimulatorNameCreateDialog` SSOT 래퍼 */
export function SaveConsultationTitleDialog({
  open,
  initialTitle,
  dialogTitle = '시뮬레이션 제목 수정',
  validationError,
  saving = false,
  onClose,
  onConfirm,
}: Props) {
  return (
    <CoverageSimulatorNameCreateDialog
      open={open}
      dialogTitle={dialogTitle}
      fieldLabel="제목"
      confirmLabel="저장"
      initialValue={initialTitle}
      errorMessage={validationError}
      onClose={onClose}
      submitting={saving}
      onConfirm={onConfirm}
    />
  )
}
