import { BaseDialog } from '../../../components/dialog/BaseDialog'
import FormButton from '../../../components/form/FormButton'

type Props = {
  open: boolean
  phase: 'confirm' | 'result'
  loading: boolean
  shareUrl: string | null
  onClose: () => void
  onCreateShare: () => void
  onCopyLink: () => void
  onNativeShare: () => void
  canNativeShare: boolean
}

export function CoverageShareDialog({
  open,
  phase,
  loading,
  shareUrl,
  onClose,
  onCreateShare,
  onCopyLink,
  onNativeShare,
  canNativeShare,
}: Props) {
  if (!open) return null

  return (
    <BaseDialog open={open} onClose={onClose} ariaLabel="고객에게 공유">
      <h2 className="coverage-simulator-dialog__title">고객에게 공유</h2>
      {phase === 'confirm' ? (
        <p className="coverage-simulator-dialog__body">
          현재 상담 내용을 공유용으로 저장하고 링크를 생성합니다.
        </p>
      ) : (
        <p className="coverage-simulator-dialog__body">
          공유 링크가 생성되었습니다. 고객은 로그인 없이 아래 링크에서 상담 내용을 확인할 수 있습니다.
        </p>
      )}
      {phase === 'result' && shareUrl ? (
        <input
          className="coverage-simulator-dialog__input cs-share-dialog__url"
          readOnly
          value={shareUrl}
          aria-label="공유 링크"
        />
      ) : null}
      <div className="coverage-simulator-dialog__actions">
        {phase === 'confirm' ? (
          <>
            <FormButton variant="secondary" className="coverage-simulator-secondary-btn" onClick={onClose} disabled={loading}>
              취소
            </FormButton>
            <FormButton variant="primary" className="coverage-simulator-primary-btn" onClick={onCreateShare} disabled={loading}>
              {loading ? '생성 중…' : '공유 링크 생성'}
            </FormButton>
          </>
        ) : (
          <>
            <FormButton variant="secondary" className="coverage-simulator-secondary-btn" onClick={onCopyLink} disabled={!shareUrl}>
              링크 복사
            </FormButton>
            {canNativeShare ? (
              <FormButton variant="secondary" className="coverage-simulator-secondary-btn" onClick={onNativeShare} disabled={!shareUrl}>
                공유하기
              </FormButton>
            ) : null}
            <FormButton variant="primary" className="coverage-simulator-primary-btn" onClick={onClose}>
              닫기
            </FormButton>
          </>
        )}
      </div>
    </BaseDialog>
  )
}
