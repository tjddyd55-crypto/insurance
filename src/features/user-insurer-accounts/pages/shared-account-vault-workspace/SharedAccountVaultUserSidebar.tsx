import FormInput from '../../../../components/form/FormInput'
import type { SharedAccountUser } from '../../api/accountShareVisibilityApi'

type SharedAccountVaultUserSidebarProps = {
  users: SharedAccountUser[]
  totalUserCount: number
  loading: boolean
  error: string
  search: string
  selectedUserId: string | null
  onSearchChange: (value: string) => void
  onOpenUser: (user: SharedAccountUser) => void
}

function resolveEmptyMessage(totalUserCount: number, visibleCount: number, search: string): string {
  if (totalUserCount === 0) {
    return '공유 허용된 사용자가 없습니다.'
  }
  if (visibleCount === 0 && search.trim()) {
    return '검색 결과가 없습니다.'
  }
  return '공유 허용된 사용자가 없습니다.'
}

export function SharedAccountVaultUserSidebar({
  users,
  totalUserCount,
  loading,
  error,
  search,
  selectedUserId,
  onSearchChange,
  onOpenUser,
}: SharedAccountVaultUserSidebarProps) {
  const emptyMessage = resolveEmptyMessage(totalUserCount, users.length, search)

  return (
    <aside className="shared-account-workspace__sidebar" aria-labelledby="shared-account-users-heading">
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
          <div className="shared-account-list__search shared-account-workspace__search">
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
            <ul className="shared-account-user-list" role="listbox" aria-label="공유 허용된 사용자">
              {users.map((user) => {
                const isActive = selectedUserId === user.userId
                return (
                  <li key={user.userId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={[
                        'shared-account-user-list__item',
                        isActive ? 'shared-account-user-list__item--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => onOpenUser(user)}
                    >
                      {user.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : null}
    </aside>
  )
}
