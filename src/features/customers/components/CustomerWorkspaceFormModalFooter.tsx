import { FormButton } from '../../../components/form'

/** 고객 작업영역 모바일 작성/수정 모달 textarea SSOT class */
export const CUSTOMER_WORKSPACE_FORM_TEXTAREA_CLASS = 'customer-workspace-form-textarea'

type Props = {
  onCancel: () => void
  onSave: () => void | Promise<void>
  busy?: boolean
  saveDisabled?: boolean
  saveLabel?: string
  cancelLabel?: string
}

/** 고객 작업영역 모바일 작성/수정 모달 footer (취소·저장) SSOT */
export function CustomerWorkspaceFormModalFooter({
  onCancel,
  onSave,
  busy = false,
  saveDisabled = false,
  saveLabel = '저장',
  cancelLabel = '취소',
}: Props) {
  return (
    <div className="customer-workspace-modal-actions">
      <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onCancel}>
        {cancelLabel}
      </FormButton>
      <FormButton
        htmlType="button"
        variant="primary"
        disabled={busy || saveDisabled}
        loading={busy}
        loadingText="저장 중…"
        onClick={() => void onSave()}
      >
        {saveLabel}
      </FormButton>
    </div>
  )
}
