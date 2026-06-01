import {
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSecondaryActionButton,
} from './CustomerWorkspaceActionButtons'

/** 고객 작업영역 모바일 작성/수정 모달 textarea SSOT class */
export const CUSTOMER_WORKSPACE_FORM_TEXTAREA_CLASS = 'customer-workspace-form-textarea'

/** 고객 작업영역 모바일 작성/수정 모달 footer wrapper SSOT class */
export const CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS = 'customer-workspace-modal-actions'

type Props = {
  onCancel: () => void
  onSave: () => void | Promise<void>
  busy?: boolean
  saveDisabled?: boolean
  saveLabel?: string
  cancelLabel?: string
  /** busy 시 primary 라벨 — 기본 '저장 중…' */
  busySaveLabel?: string
}

/**
 * 고객 작업영역 모바일 작성/수정 모달 footer (취소·저장) SSOT.
 * DOM: customer-workspace-modal-actions > button.customer-workspace-action-button--*
 * (목록 수정/삭제/할일 버튼과 동일 class — CustomerWorkspaceMobileScope 래퍼 필수)
 */
export function CustomerWorkspaceFormModalFooter({
  onCancel,
  onSave,
  busy = false,
  saveDisabled = false,
  saveLabel = '저장',
  cancelLabel = '취소',
  busySaveLabel = '저장 중…',
}: Props) {
  return (
    <div className={CUSTOMER_WORKSPACE_MODAL_ACTIONS_CLASS}>
      <CustomerWorkspaceSecondaryActionButton disabled={busy} onClick={onCancel}>
        {cancelLabel}
      </CustomerWorkspaceSecondaryActionButton>
      <CustomerWorkspacePrimaryActionButton
        disabled={busy || saveDisabled}
        onClick={() => void onSave()}
      >
        {busy ? busySaveLabel : saveLabel}
      </CustomerWorkspacePrimaryActionButton>
    </div>
  )
}
