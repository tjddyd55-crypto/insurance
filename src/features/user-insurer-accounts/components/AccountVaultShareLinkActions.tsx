import { FormButton } from '../../../components/form'
import type { AccountVaultShareLinkViewProps } from '../hooks/useAccountVaultShareLinkState'

export function AccountVaultShareLinkActions({
  hasShareUrl,
  loading,
  pending,
  statusLabel,
  onCreateShareLink,
  onRegenerateShareLink,
  onCopyShareLink,
  onOpenShareLink,
}: AccountVaultShareLinkViewProps) {
  if (loading) {
    return null
  }

  const isErrorStatus = statusLabel === '생성 실패' || statusLabel === '처리 실패'

  return (
    <div className="account-vault-share-link-actions" aria-label="외부 수정 URL">
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
          외부 URL 생성
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
            새로생성
          </FormButton>
        </>
      )}
    </div>
  )
}
