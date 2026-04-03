import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { isGaTenantStaffRole } from '../../auth/roleGuards'
import {
  buildGaTenantMenu,
  GA_STAFF_EXTRA_MENU,
  type GaTenantMenuItem,
} from '../gaTenantMenu'

type MenuItem = GaTenantMenuItem

const SUPER_ADMIN_MENU: MenuItem[] = [
  { label: 'GA 관리', path: '/admin/ga' },
  { label: '담당자 생성', path: '/admin/create-staff' },
  { label: '유저 관리', path: '/admin/users' },
  { label: '기능 요청 관리', path: '/internal/admin/feature-requests' },
]

function menuForSession(role: string | undefined, gaCode: string | undefined): MenuItem[] {
  if (role === 'SUPER_ADMIN') {
    return SUPER_ADMIN_MENU
  }
  const tenantBase = buildGaTenantMenu(gaCode)
  if (role === 'GA_ADMIN' || role === 'GA_STAFF') {
    return [...tenantBase, ...GA_STAFF_EXTRA_MENU]
  }
  if (role === 'USER') {
    return tenantBase
  }
  return []
}

function showFeatureRequestSection(role: string | undefined): boolean {
  return role === 'USER' || role === 'GA_STAFF'
}

function pathIsActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/contacts') {
    return pathname === '/contacts' || pathname === '/insurance/contacts'
  }
  if (itemPath === '/contacts/manage') {
    return pathname === '/contacts/manage' || pathname === '/insurance/company-registry'
  }
  if (itemPath.startsWith('/customers')) {
    return pathname === '/customers'
  }
  if (itemPath === '/application') {
    return pathname === '/application' || pathname.startsWith('/application/')
  }
  if (itemPath === '/feature-request') {
    return pathname === '/feature-request'
  }
  if (itemPath === '/feature-requests/my') {
    return pathname === '/feature-requests/my'
  }
  if (itemPath.startsWith('/internal/admin/')) {
    return pathname === itemPath
  }
  if (itemPath === '/admin/ga') {
    return pathname === '/admin/ga' || pathname === '/admin/create-ga'
  }
  return pathname === itemPath
}

function attemptAppExit(navigate: ReturnType<typeof useNavigate>) {
  if (!window.confirm('앱을 종료하시겠습니까?')) {
    return
  }
  window.close()
  window.setTimeout(() => {
    if (typeof window.history.go === 'function' && window.history.length > 2) {
      window.history.go(-2)
    } else {
      navigate('/', { replace: true })
    }
  }, 120)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const role = user?.role
  const showStaffDirectoryNote = isGaTenantStaffRole(role)
  const showFeatureFooter = showFeatureRequestSection(role)
  const menuItems = menuForSession(role, user?.gaCode)
  const pathname = location.pathname

  return (
    <main className="page dashboard-page--centered">
      <div className="dashboard-menu-shell">
        <header className="page-header dashboard-page__header">
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

          {showFeatureFooter ? (
            <div className="dashboard-menu-footer" role="group" aria-label="서비스 안내">
              <p className="dashboard-menu-static" aria-disabled="true">
                추가 기능 개발 중
              </p>
              <button
                type="button"
                className={`menu-item${pathIsActive(pathname, '/feature-request') ? ' active' : ''}`}
                onClick={() => navigate('/feature-request')}
              >
                추가 기능 요청하기
              </button>
              <button
                type="button"
                className={`menu-item${pathIsActive(pathname, '/feature-requests/my') ? ' active' : ''}`}
                onClick={() => navigate('/feature-requests/my')}
              >
                내 기능 요청
              </button>
            </div>
          ) : null}

          {showStaffDirectoryNote ? (
            <p className="dashboard-menu-note">
              보험사 마스터는 「원수사 연락처」에서 확인하고, 「원수사 연락처 관리」에서만 저장·수정합니다.
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

        <div className="dashboard-app-exit-wrap">
          <button
            type="button"
            className="button button--secondary dashboard-app-exit"
            onClick={() => attemptAppExit(navigate)}
          >
            앱 종료
          </button>
        </div>
      </div>
    </main>
  )
}
