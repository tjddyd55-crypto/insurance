import { AccountVaultManager } from '../../components/AccountVaultManager'
import { AccountVaultShareLinkActions } from '../../components/AccountVaultShareLinkActions'
import { AccountShareVisibilityToggle } from '../../components/AccountShareVisibilityToggle'
import type { UserInsurerAccountsPageViewProps } from '../UserInsurerAccountsPage'

export default function UserInsurerAccountsMobileView({
  adapter,
  shareLink,
  shareVisibility,
}: UserInsurerAccountsPageViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile page--with-back content-wrapper page-shell">
      <header className="user-insurer-accounts-page__header user-insurer-accounts-page__header--toolbar">
        <div className="user-insurer-accounts-page__header-main">
          <h1>계정관리</h1>
          <p className="user-insurer-accounts-page__desc">
            보험회사별 아이디·비밀번호는 현재 로그인한 설계사 개인 데이터입니다.
          </p>
        </div>
        <div className="user-insurer-accounts-page__share-controls">
          <AccountShareVisibilityToggle {...shareVisibility} />
          <AccountVaultShareLinkActions {...shareLink} />
        </div>
      </header>
      <AccountVaultManager mode="internal" layout="stacked" adapter={adapter} />
    </main>
  )
}
