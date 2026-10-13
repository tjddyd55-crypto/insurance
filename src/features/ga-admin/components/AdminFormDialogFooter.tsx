import { DialogActions } from '../../../components/dialog/DialogActions'
import FormButton from '../../../components/form/FormButton'

type Props = {
  formId: string
  onCancel: () => void
  submitLabel: string
  busy?: boolean
  submitDisabled?: boolean
}

/** GA 관리 FormDialog — 취소 + 주 액션 (backdrop/ESC 닫기 없음, FormDialog X 별도) */
export function AdminFormDialogFooter({
  formId,
  onCancel,
  submitLabel,
  busy = false,
  submitDisabled = false,
}: Props) {
  return (
    <DialogActions className="ga-admin-form-dialog__actions">
      <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onCancel}>
        취소
      </FormButton>
      <FormButton
        htmlType="submit"
        form={formId}
        variant="primary"
        loading={busy}
        disabled={submitDisabled || busy}
      >
        {submitLabel}
      </FormButton>
    </DialogActions>
  )
}
