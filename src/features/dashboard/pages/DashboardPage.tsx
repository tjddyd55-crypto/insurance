import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
type MenuItem = { label: string; path: string }

const USER_MENU: MenuItem[] = [
  { label: '고객 관리', path: '/customers' },
  { label: '자동차보험 신청서', path: '/application' },
  { label: '원수사 연락처 조회', path: '/contacts' },
]

const STAFF_MENU: MenuItem[] = [
  { label: '원수사 연락처 조회', path: '/contacts' },
  { label: '원수사 연락처 관리', path: '/contacts/manage' },
]

function menuForRole(role: string | undefined): MenuItem[] {
  if (role === 'user') {
    return USER_MENU
  }
  if (role === 'staff') {
    return STAFF_MENU
  }
  if (role === 'super_admin') {
    return [{ label: '담당자 생성', path: '/admin/create-staff' }, ...STAFF_MENU]
  }
  return []
}

function pathIsActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/contacts') {
    return pathname === '/contacts' || pathname === '/insurance/contacts'
  }
  if (itemPath === '/contacts/manage') {
    return pathname === '/contacts/manage' || pathname === '/insurance/company-registry'
  }
  return pathname === itemPath
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const role = user?.role
  const isStaff = role === 'staff' || role === 'super_admin'
  const menuItems = menuForRole(role)
  const pathname = location.pathname

  return (
    <main className="page dashboard-page--centered">
      <header className="page-header">
        <h1>메뉴</h1>
      </header>

      <section className="dashboard-menu-card">
        <h2 className="dashboard-section-title visually-hidden">주요 메뉴</h2>
        <nav className="menu-card" aria-label="주요 메뉴">
          {menuItems.map((item) => {
            const isActive = pathIsActive(pathname, item.path)
            return (
              <button
                key={`${item.path}-${item.label}`}
                type="button"
                className={`menu-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {isStaff ? (
          <p className="dashboard-menu-note">
            보험사 마스터는 「원수사 연락처 조회」에서 확인하고, 「원수사 연락처 관리」에서만 저장·수정합니다.
          </p>
        ) : null}

        <button
          className="button button--secondary button--full dashboard-logout"
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
