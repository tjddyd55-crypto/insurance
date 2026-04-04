import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchInsurerManagersHealth, type InsurerManagersHealth } from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import { isGaStaffReadOnlyUi } from '../../auth/roleGuards'
import {
  buildGaTenantDashboardMenu,
  GA_STAFF_MENU,
  INSURER_MANAGER_MENU,
  type GaTenantMenuItem,
} from '../gaTenantMenu'

type MenuItem = GaTenantMenuItem

const AUDIT_MENU: MenuItem = { label: '보안 감사 로그', path: '/admin/audit-logs' }

const SUPER_ADMIN_MENU: MenuItem[] = [
  { label: 'GA 관리', path: '/admin/ga' },
  { label: '담당자 관리', path: '/admin/delegates' },
  { label: '유저 관리', path: '/admin/users' },
  { label: '기능 요청 관리', path: '/internal/admin/feature-requests' },
]

function menuForSession(
  role: string | undefined,
  gaCode: string | undefined,
  gaName: string | undefined,
): MenuItem[] {
  if (role === 'SUPER_ADMIN') {
    return [...SUPER_ADMIN_MENU, AUDIT_MENU]
  }
  if (role === 'INSURER_MANAGER') {
    return [...INSURER_MANAGER_MENU]
  }
  if (role === 'GA_STAFF') {
    return GA_STAFF_MENU
  }
  if (role === 'GA_ADMIN' || role === 'USER') {
    const items = buildGaTenantDashboardMenu(gaCode, gaName)
    if (role === 'GA_ADMIN') {
      items.push(AUDIT_MENU)
    }
    return items
  }
  return []
}

function showInsurerManagerHealthBanner(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'GA_ADMIN'
}

function pathIsActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/contacts') {
    return pathname === '/contacts' || pathname === '/insurance/contacts'
  }
  if (itemPath === '/insurance/contacts') {
    return pathname === '/insurance/contacts' || pathname === '/contacts'
  }
  if (itemPath === '/portal/newsletters') {
    return pathname === '/portal/newsletters' || pathname.startsWith('/portal/newsletters/')
  }
  if (itemPath === '/contacts/manage') {
    return pathname === '/contacts/manage' || pathname === '/insurance/company-registry'
  }
  if (itemPath === '/insurance/company-registry') {
    return pathname === '/insurance/company-registry' || pathname.startsWith('/insurance/company-registry/')
  }
  if (itemPath.startsWith('/customers')) {
    return pathname === '/customers'
  }
  if (itemPath === '/application') {
    return pathname === '/application' || pathname.startsWith('/application/')
  }
  if (itemPath === '/feature-request') {
    return pathname === '/feature-request' || pathname === '/feature-requests/my'
  }
  if (itemPath === '/account/reset') {
    return pathname === '/account/reset'
  }
  if (itemPath === '/profile') {
    return pathname === '/profile'
  }
  if (itemPath.startsWith('/internal/')) {
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
  }
  if (itemPath === '/admin/ga') {
    return pathname === '/admin/ga' || pathname === '/admin/create-ga'
  }
  if (itemPath === '/admin/delegates') {
    return pathname === '/admin/delegates' || pathname === '/admin/create-staff'
  }
  if (itemPath === '/insurer-managers') {
    return pathname === '/insurer-managers'
  }
  if (itemPath === '/insurer/news') {
    if (pathname.startsWith('/insurer/news/upload')) {
      return false
    }
    return pathname === '/insurer/news' || pathname.startsWith('/insurer/news/')
  }
  if (itemPath === '/insurer/news/upload') {
    return pathname === '/insurer/news/upload'
  }
  if (itemPath === '/admin/audit-logs') {
    return pathname === '/admin/audit-logs'
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
  const { user, logout, token } = useAuth()
  const role = user?.role
  const showStaffReadOnlyNote = isGaStaffReadOnlyUi(role)
  const showImHealth = showInsurerManagerHealthBanner(role)
  const menuItems = menuForSession(role, user?.gaCode, user?.gaName)
  const pathname = location.pathname
  const [imHealthErr, setImHealthErr] = useState('')
  const [imHealth, setImHealth] = useState<InsurerManagersHealth | null>(null)

  const loadImHealth = useCallback(async () => {
    if (!showImHealth || !token?.trim()) {
      return
    }
    setImHealthErr('')
    try {
      setImHealth(await fetchInsurerManagersHealth(token))
    } catch {
      setImHealthErr('원수사 담당자 정합성 상태를 확인하지 못했습니다.')
    }
  }, [showImHealth, token])

  useEffect(() => {
    void loadImHealth()
  }, [loadImHealth])

  return (
    <main className="page dashboard-page--centered">
      <div className="dashboard-menu-shell">
        <header className="page-header dashboard-page__header">
          <h1>메뉴</h1>
        </header>

        {imHealthErr ? (
          <p className="status status--error" style={{ maxWidth: 420, margin: '0 auto 12px' }}>
            {imHealthErr}
          </p>
        ) : null}
        {imHealth && imHealth.broken > 0 ? (
          <div
            className="status status--error"
            role="alert"
            style={{ maxWidth: 420, margin: '0 auto 12px', padding: '12px 14px', textAlign: 'left' }}
          >
            <strong>담당자 데이터 정합성 오류</strong>
            <p style={{ margin: '8px 0 0', fontSize: 14 }}>
              원수사 담당자 {imHealth.total}명 중 {imHealth.broken}명에 company_id·분류·GA 불일치 등이
              있습니다. DB 복구 스크립트(<code>recover:insurer-managers</code>)와{' '}
              <code>audit-insurer-manager-company.sql</code>로 점검해 주세요.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.95 }}>
              null·무효 company_id: {imHealth.nullCompany}, FK 깨짐: {imHealth.fkBroken}, GA 불일치:{' '}
              {imHealth.gaMismatch}, 분류 불일치: {imHealth.invalidCategory}
            </p>
          </div>
        ) : null}

        <section className="dashboard-menu-card">
          <h2 className="dashboard-section-title visually-hidden">주요 메뉴</h2>
          {showStaffReadOnlyNote ? (
            <p className="dashboard-menu-note" role="status">
              GA_STAFF 계정은 연락처 관련 입력 화면 일부가 <strong>읽기 전용</strong>입니다. 저장·등록은 GA
              관리자만 가능합니다.
            </p>
          ) : null}
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
