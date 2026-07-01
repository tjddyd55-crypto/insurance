import { FormButton, FormInput } from '../../../components/form'
import type { AccountVaultShareLinkViewProps } from '../hooks/useAccountVaultShareLinkState'

export function AccountVaultShareLinkSection({
  shareUrl,
  hasShareUrl,
  loading,
  pending,
  error,
  copyFeedback,
  onCreateShareLink,
  onRegenerateShareLink,
  onCopyShareLink,
  onOpenShareLink,
}: AccountVaultShareLinkViewProps) {
  return (
    <section
      className="user-insurer-accounts-section user-insurer-accounts-section--share-link account-vault-share-link-section"
      aria-label="외부 수정 URL"
    >
      <header className="user-insurer-accounts-section__banner account-vault-share-link-section__banner">
        <h2 className="user-insurer-accounts-section__title">외부 수정 URL</h2>
      </header>
      <div className="user-insurer-accounts-section__body account-vault-share-link-section__body">
        <p className="user-insurer-accounts-page__muted account-vault-share-link-section__desc">
          이 URL로 접속하면 계정관리 화면만 열리고, 아이디와 비밀번호를 확인·수정할 수 있습니다.
        </p>
        <p className="user-insurer-accounts-page__muted account-vault-share-link-section__desc">
          새 URL을 생성하면 기존 URL은 더 이상 사용할 수 없습니다.
        </p>

        {loading ? <p className="user-insurer-accounts-page__muted">외부 URL 불러오는 중…</p> : null}
        {error ? (
          <p className="user-insurer-accounts-page__error" role="alert">
            {error}
          </p>
        ) : null}
        {copyFeedback ? (
          <p className="account-vault-share-link-section__feedback" role="status">
            {copyFeedback}
          </p>
        ) : null}

        {!loading && !hasShareUrl ? (
          <div className="account-vault-share-link-section__actions">
            <FormButton
              htmlType="button"
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => void onCreateShareLink()}
            >
              외부 URL 생성
            </FormButton>
          </div>
        ) : null}

        {!loading && hasShareUrl && shareUrl ? (
          <>
            <label className="account-vault-share-link-section__url-field">
              <span className="account-vault-share-link-section__url-label">현재 URL</span>
              <FormInput value={shareUrl} readOnly aria-readonly="true" />
            </label>
            <div className="account-vault-share-link-section__actions">
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
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() => void onRegenerateShareLink()}
              >
                새 URL 다시 생성
              </FormButton>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
