import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const role = user?.role

  return (
    <main className="page">
      <header className="page-header">
        <h1>메뉴</h1>
        <p>{user?.username} 님, 사용할 기능 메뉴를 선택하세요.</p>
      </header>

      <section className="card dashboard-menu-card">
        <h2 className="dashboard-section-title">업무 메뉴</h2>
        <nav aria-label="주요 메뉴">
          <ul className="dashboard-sidebar-list">
            {role === 'user' ? (
              <>
                <li>
                  <button
                    className="button button--primary button--full"
                    type="button"
                    onClick={() => navigate('/application')}
                  >
                    자동차 신청서
                  </button>
                </li>
                <li>
                  <button className="button button--full" type="button" onClick={() => navigate('/customers')}>
                    고객 관리
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/reinsurer-contacts')}
                  >
                    원수사 연락처
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/company-registry')}
                  >
                    보험사 연락처(마스터)
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/insurance-updates')}
                  >
                    업데이트 현황
                  </button>
                </li>
              </>
            ) : null}

            {role === 'staff' ? (
              <>
                <li>
                  <button
                    className="button button--primary button--full"
                    type="button"
                    onClick={() => navigate('/menu/reinsurer-contacts')}
                  >
                    연락처 관리
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/company-registry')}
                  >
                    보험사 연락처(마스터)
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/insurance-updates')}
                  >
                    업데이트 현황
                  </button>
                </li>
              </>
            ) : null}

            {role === 'super_admin' ? (
              <>
                <li>
                  <button
                    className="button button--primary button--full"
                    type="button"
                    onClick={() => navigate('/admin/create-staff')}
                  >
                    담당자 생성
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/reinsurer-contacts')}
                  >
                    연락처 관리
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/company-registry')}
                  >
                    보험사 연락처(마스터)
                  </button>
                </li>
                <li>
                  <button className="button button--full" type="button" onClick={() => navigate('/application')}>
                    자동차 신청서
                  </button>
                </li>
                <li>
                  <button
                    className="button button--full"
                    type="button"
                    onClick={() => navigate('/menu/insurance-updates')}
                  >
                    업데이트 현황
                  </button>
                </li>
              </>
            ) : null}
          </ul>
        </nav>

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
