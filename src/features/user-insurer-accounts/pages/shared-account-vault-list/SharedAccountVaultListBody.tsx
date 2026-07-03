import FormInput from '../../../../components/form/FormInput'
import type { SharedAccountVaultListViewProps } from '../../hooks/useSharedAccountVaultListState'

/**
 * 공유 계정관리 목록 본문(이름만 표시). PC/Mobile 뷰가 최상위 main 만 다르게
 * 감싸고 본문은 이 컴포넌트를 공유한다(로직/마크업 중복 방지).
 */
export function SharedAccountVaultListBody({
  users,
  loading,
  error,
  search,
  onSearchChange,
  onOpenUser,
}: SharedAccountVaultListViewProps) {
  return (
    <>
      <header className="user-insurer-accounts-page__header">
        <div className="user-insurer-accounts-page__header-main">
          <h1>공유 계정관리</h1>
        </div>
      </header>

      <p className="shared-account-list__banner">
        같은 GA에서 계정관리 공유를 켠 사용자 목록입니다. 이름을 누르면 해당 사용자의 계정관리
        화면이 열립니다.
      </p>

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
            <p className="shared-account-list__empty">공유된 계정관리가 없습니다.</p>
          ) : (
            <ul className="shared-account-list__items">
              {users.map((user) => (
                <li key={user.userId}>
                  <button
                    type="button"
                    className="shared-account-list__item-btn"
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
    </>
  )
}
