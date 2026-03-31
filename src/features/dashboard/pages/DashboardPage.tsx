import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  return (
    <main className="page">
      <header className="page-header">
        <h1>메뉴</h1>
        <p>{user?.username} 님, 사용할 기능 메뉴를 선택하세요.</p>
      </header>

      <section className="card dashboard-menu-card">
        <h2 className="dashboard-section-title">업무 메뉴</h2>
        <button
          className="button button--primary button--full"
          type="button"
          onClick={() => navigate('/menu/car-insurance')}
        >
          자동차보험신청서
        </button>
        <button
          className="button button--full"
          type="button"
          onClick={() => navigate('/menu/reinsurer-contacts')}
        >
          원수사 연락처
        </button>
        <button
          className="button button--full"
          type="button"
          onClick={() => navigate('/menu/insurance-updates')}
        >
          업데이트 현황
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
