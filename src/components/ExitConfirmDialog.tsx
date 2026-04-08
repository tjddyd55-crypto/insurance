export type ExitConfirmDialogProps = {
  message: string
  titleId: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * AppExitConfirm(POP 차단) · 고객 등록 이탈 등 동일한 이탈 확인 UI.
 * window.confirm 대신 이 모달만 사용한다.
 */
export function ExitConfirmDialog({ message, titleId, onCancel, onConfirm }: ExitConfirmDialogProps) {
  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal app-exit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h3 id={titleId}>{message}</h3>
        <div className="modal-actions app-exit-modal__actions">
          <button type="button" className="modal-cancel" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="confirm" onClick={onConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
