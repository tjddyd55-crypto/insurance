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
    <section className="shared-account-list-link" aria-label="공유 계정관리 목록 URL">
      {confirmDialog}
      <div className="shared-account-list-link__header">
        <h2 className="shared-account-list-link__title">공유 계정관리 목록 URL</h2>
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
      </div>
      <p className="shared-account-list-link__desc">
        이 URL을 전달하면 로그인 없이 공유 허용된 사용자 목록을 볼 수 있습니다.
      </p>
      <p className="shared-account-list-link__warning">
        이 URL을 가진 사람은 공유 허용된 사용자의 계정관리 내용을 볼 수 있고 수정할 수 있습니다.
        필요한 사람에게만 전달하세요.
      </p>
      <div className="account-vault-share-link-actions">
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
    </section>
  )
}
