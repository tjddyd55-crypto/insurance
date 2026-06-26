import type { UserInsurerAccountsViewProps } from '../../hooks/useUserInsurerAccountsState'
import { UserInsurerAccountsPanel } from '../../components/UserInsurerAccountsPanel'

export default function UserInsurerAccountsPCView(props: UserInsurerAccountsViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--pc page--with-back content-wrapper page-shell">
      <header className="user-insurer-accounts-page__header">
        <h1>계정관리</h1>
        <p className="user-insurer-accounts-page__desc">
          보험회사별 아이디·비밀번호·메모는 현재 로그인한 설계사 개인 데이터입니다.
        </p>
      </header>
      <UserInsurerAccountsPanel {...props} layout="dual-column" />
    </main>
  )
}
