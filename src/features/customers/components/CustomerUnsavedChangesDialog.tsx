import { Button } from '../../../components/ui/Button'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'

export type CustomerUnsavedChangesChoice = 'save' | 'discard' | 'cancel'

export type CustomerUnsavedChangesDialogProps = {
  open: boolean
  busy?: boolean
  onSave: () => void | Promise<void>
  onDiscard: () => void
  onCancel: () => void
}

/**
 * 고객 수정 이탈 확인 — 저장 / 저장안함 / 취소(계속 편집).
 * ConfirmDialog(2버튼)와 달리 저장 경로를 제공한다.
 */
export function CustomerUnsavedChangesDialog({
  open,
  busy = false,
  onSave,
  onDiscard,
  onCancel,
}: CustomerUnsavedChangesDialogProps) {
  return (
    <BaseDialog
      open={open}
      onClose={onCancel}
      ariaLabel="변경사항 닫기"
      closeOnBackdrop={false}
      closeOnEsc={!busy}
      panelClassName="max-w-lg"
      usePortal
      overlayClassName="!z-[100100]"
    >
      <h3 className="text-lg font-semibold text-[var(--text-main)]">변경사항 닫기</h3>
      <p className="mt-3 text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">
        변경사항이 저장되지 않았습니다. 어떻게 하시겠습니까?
      </p>
      <DialogActions className="user-modal-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button type="button" variant="danger" onClick={onDiscard} disabled={busy}>
          저장안함
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void onSave()}
          disabled={busy}
          loading={busy}
          loadingText="저장 중…"
        >
          저장
        </Button>
      </DialogActions>
    </BaseDialog>
  )
}
