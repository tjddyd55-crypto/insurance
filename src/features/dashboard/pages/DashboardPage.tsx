import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  return (
    <main className="page">
      <header className="page-header">
        <h1>대시보드</h1>
        <p>{user?.username} 님, 자동차 보험 신청서를 관리하세요.</p>
      </header>

      <section className="card dashboard-card">
        <button
          className="button button--primary button--full"
          type="button"
          onClick={() => navigate('/form/create')}
        >
          신청서 작성
        </button>
        <button className="button button--full" type="button" onClick={() => navigate('/my-forms')}>
          내 신청서 목록
        </button>
        <button
          className="button button--secondary button--full"
          type="button"
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        >
          로그아웃
        </button>
      </section>
    </main>
  )
}
