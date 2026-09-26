import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'
import type { CoverageShareListItem } from '../api/coverageSimulatorShareApi'
import { CoverageShareDialogHistory } from './CoverageShareDialogHistory'

type Props = {
  open: boolean
  phase: 'confirm' | 'result'
  loading: boolean
  createError: string | null
  shareUrl: string | null
  historyShares: CoverageShareListItem[]
  historyLoading: boolean
  historyError: string | null
  onClose: () => void
  onCreateShare: () => void
  onCopyLink: () => void
  onNativeShare: () => void
  onRetryHistory: () => void
  onCopyHistoryLink: (url: string | null) => void
  onRevokeShare: (shareId: string) => void
  canNativeShare: boolean
}

export function CoverageShareDialog({
  open,
  loading,
  createError,
  shareUrl,
  historyShares,
  historyLoading,
  historyError,
  onClose,
  onCopyLink,
  onNativeShare,
  onRetryHistory,
  onCopyHistoryLink,
  onRevokeShare,
  canNativeShare,
}: Props) {
  if (!open) return null

  return (
    <BaseDialog open={open} onClose={onClose} ariaLabel="고객에게 공유">
      <h2 className="coverage-simulator-dialog__title">고객에게 공유</h2>
      <p className="coverage-simulator-dialog__body">
        링크 복사 또는 공유하기를 누르면 현재 상담 내용이 공유용으로 저장됩니다.
      </p>
      {createError ? <p className="coverage-simulator-dialog__error">{createError}</p> : null}
      {shareUrl ? (
        <input
          className="coverage-simulator-dialog__input cs-share-dialog__url"
          readOnly
          value={shareUrl}
          aria-label="공유 링크"
        />
      ) : null}
      <CoverageShareDialogHistory
        shares={historyShares}
        loading={historyLoading}
        error={historyError}
        onRetry={onRetryHistory}
        onCopyLink={onCopyHistoryLink}
        onRevoke={onRevokeShare}
      />
      <div className="coverage-simulator-dialog__actions">
        <FormButton
          variant="secondary"
          className="coverage-simulator-secondary-btn"
          onClick={onCopyLink}
          disabled={loading}
        >
          {loading ? '준비 중…' : '링크 복사'}
        </FormButton>
        {canNativeShare ? (
          <FormButton
            variant="secondary"
            className="coverage-simulator-secondary-btn"
            onClick={onNativeShare}
            disabled={loading}
          >
            공유하기
          </FormButton>
        ) : null}
        <FormButton variant="primary" className="coverage-simulator-primary-btn" onClick={onClose} disabled={loading}>
          닫기
        </FormButton>
      </div>
    </BaseDialog>
  )
}
