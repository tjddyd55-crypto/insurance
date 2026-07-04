import { FormButton } from '../../../components/form'
import type { SharedAccountListLinkViewProps } from '../hooks/useSharedAccountListLinkState'

type SharedAccountListLinkActionsProps = SharedAccountListLinkViewProps & {
  headingLabel?: string
}

function renderStatusLabel(statusLabel: string) {
  const isErrorStatus = statusLabel === '생성 실패' || statusLabel === '처리 실패'

  return (
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
  )
}

function renderActionButtons({
  hasShareUrl,
  pending,
  onCreateShareLink,
  onRegenerateShareLink,
  onCopyShareLink,
  onOpenShareLink,
}: Pick<
  SharedAccountListLinkViewProps,
  | 'hasShareUrl'
  | 'pending'
  | 'onCreateShareLink'
  | 'onRegenerateShareLink'
  | 'onCopyShareLink'
  | 'onOpenShareLink'
>) {
  if (!hasShareUrl) {
    return (
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => void onCreateShareLink()}
      >
        URL 생성
      </FormButton>
    )
  }

  return (
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
  )
}

export function SharedAccountListLinkActions({
  headingLabel,
  hasShareUrl,
  loading,
  pending,
  statusLabel,
  onCreateShareLink,
  onRegenerateShareLink,
  onCopyShareLink,
  onOpenShareLink,
  confirmDialog,
}: SharedAccountListLinkActionsProps) {
  if (loading) {
    return confirmDialog
  }

  const buttons = renderActionButtons({
    hasShareUrl,
    pending,
    onCreateShareLink,
    onRegenerateShareLink,
    onCopyShareLink,
    onOpenShareLink,
  })

  if (headingLabel) {
    return (
      <div className="shared-account-list-link-actions" aria-label="공유 계정관리 목록 URL">
        {confirmDialog}
        <div className="shared-account-list-link__heading">
          <span className="shared-account-list-link__label">{headingLabel}</span>
          {statusLabel ? renderStatusLabel(statusLabel) : null}
        </div>
        <div className="account-vault-share-link-actions account-vault-share-link-actions--toolbar">
          {buttons}
        </div>
      </div>
    )
  }

  return (
    <div className="account-vault-share-link-actions" aria-label="공유 계정관리 목록 URL">
      {confirmDialog}
      {statusLabel ? renderStatusLabel(statusLabel) : null}
      {buttons}
    </div>
  )
}
