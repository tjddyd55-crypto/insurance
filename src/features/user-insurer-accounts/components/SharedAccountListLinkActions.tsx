import { FormButton } from '../../../components/form'
import type { SharedAccountListLinkViewProps } from '../hooks/useSharedAccountListLinkState'

export function SharedAccountListLinkActions({
  hasShareUrl,
  loading,
  pending,
  statusLabel,
  onCreateShareLink,
  onRegenerateShareLink,
  onCopyShareLink,
  onOpenShareLink,
  confirmDialog,
}: SharedAccountListLinkViewProps) {
  if (loading) {
    return confirmDialog
  }

  const isErrorStatus = statusLabel === '생성 실패' || statusLabel === '처리 실패'

  return (
    <div className="account-vault-share-link-actions" aria-label="공유 계정관리 목록 URL">
      {confirmDialog}
      {statusLabel ? (
        <span
          className={[
            'account-vault-share-link-actions__status',
            isErrorStatus ? 'account-vault-share-link-actions__status--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="status"
        >
          {statusLabel}
        </span>
      ) : null}
      {!hasShareUrl ? (
        <FormButton
          htmlType="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => void onCreateShareLink()}
        >
          URL 생성
        </FormButton>
      ) : (
        <>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => void onCopyShareLink()}
          >
            복사
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={onOpenShareLink}
          >
            열기
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => void onRegenerateShareLink()}
          >
            URL 새로생성
          </FormButton>
        </>
      )}
    </div>
  )
}
