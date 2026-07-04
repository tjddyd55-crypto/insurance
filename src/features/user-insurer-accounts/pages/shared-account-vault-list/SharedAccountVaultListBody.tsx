import FormInput from '../../../../components/form/FormInput'
import { SharedAccountListLinkActions } from '../../components/SharedAccountListLinkActions'
import type { SharedAccountVaultListViewProps } from '../../hooks/useSharedAccountVaultListState'

function resolveEmptyMessage(totalUserCount: number, visibleCount: number, search: string): string {
  if (totalUserCount === 0) {
    return '공유 허용된 사용자가 없습니다.'
  }
  if (visibleCount === 0 && search.trim()) {
    return '검색 결과가 없습니다.'
  }
  return '공유 허용된 사용자가 없습니다.'
}

/**
 * 공유 계정관리 목록 본문(이름만 표시). PC/Mobile·공개/로그인 STAFF 가 본문 마크업을 공유한다.
 */
export function SharedAccountVaultListBody({
  users,
  totalUserCount,
  loading,
  error,
  search,
  onSearchChange,
  onOpenUser,
  listLink,
}: SharedAccountVaultListViewProps) {
  const emptyMessage = resolveEmptyMessage(totalUserCount, users.length, search)

  return (
    <>
      <header className="user-insurer-accounts-page__header user-insurer-accounts-page__header--toolbar">
        <div className="user-insurer-accounts-page__header-main">
          <h1>공유 계정관리</h1>
        </div>
        {listLink ? (
          <div className="user-insurer-accounts-page__share-controls shared-account-list__link-controls">
            <SharedAccountListLinkActions {...listLink} />
          </div>
        ) : null}
      </header>

      <section className="shared-account-list__users-section" aria-labelledby="shared-account-users-heading">
        <h2 id="shared-account-users-heading" className="shared-account-list__section-title">
          공유 허용된 사용자
        </h2>

        {loading ? <p className="shared-account-list__muted">불러오는 중…</p> : null}
        {error ? (
          <p className="user-insurer-accounts-page__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="shared-account-list__search">
              <FormInput
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="이름으로 검색"
                aria-label="사용자 이름 검색"
              />
            </div>

            {users.length === 0 ? (
              <p className="shared-account-list__empty">{emptyMessage}</p>
            ) : (
              <ul className="shared-account-users-grid">
                {users.map((user) => (
                  <li key={user.userId}>
                    <button
                      type="button"
                      className="shared-account-user-card"
                      onClick={() => onOpenUser(user)}
                    >
                      {user.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>
    </>
  )
}
