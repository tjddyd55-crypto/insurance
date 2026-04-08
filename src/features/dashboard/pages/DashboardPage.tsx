import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchInsurerManagersHealth, type InsurerManagersHealth } from '../../auth/authApi'
import { fetchTeamMembers } from '../../team/api/teamApi'
import { useAuth } from '../../auth/AuthProvider'
import { isGaStaffReadOnlyUi } from '../../auth/roleGuards'
import { Button, Modal } from '../../../components/ui'
import {
  buildGaTenantDashboardMenu,
  GA_STAFF_MENU,
  INSURER_MANAGER_MENU,
  type GaTenantDashboardMenuEntry,
  type GaTenantMenuItem,
} from '../gaTenantMenu'

type MenuEntry = GaTenantDashboardMenuEntry

function menuItemsToEntries(items: GaTenantMenuItem[]): MenuEntry[] {
  return items.map((i) => ({ type: 'link' as const, label: i.label, path: i.path }))
}

const AUDIT_MENU: GaTenantMenuItem = { label: '보안 감사 로그', path: '/admin/audit-logs' }

const SUPER_ADMIN_MENU: GaTenantMenuItem[] = [
  { label: 'GA 관리', path: '/admin/ga' },
  { label: '담당자 관리', path: '/admin/delegates' },
  { label: '유저 관리', path: '/admin/users' },
  { label: '운영 통계', path: '/admin/analytics' },
  { label: '기능 요청 관리', path: '/internal/admin/feature-requests' },
]

function menuForSession(
  role: string | undefined,
  gaCode: string | undefined,
  gaName: string | undefined,
): MenuEntry[] {
  if (role === 'SUPER_ADMIN') {
    return [...menuItemsToEntries(SUPER_ADMIN_MENU), { type: 'link', label: AUDIT_MENU.label, path: AUDIT_MENU.path }]
  }
  if (role === 'INSURER_MANAGER') {
    return menuItemsToEntries(INSURER_MANAGER_MENU)
  }
  if (role === 'GA_STAFF') {
    return menuItemsToEntries(GA_STAFF_MENU)
  }
  if (role === 'GA_ADMIN' || role === 'USER') {
    const items = buildGaTenantDashboardMenu(gaCode, gaName)
    if (role === 'GA_ADMIN') {
      items.push({ type: 'divider' }, { type: 'link', label: AUDIT_MENU.label, path: AUDIT_MENU.path })
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
  if (itemPath === '/admin/analytics') {
    return pathname === '/admin/analytics'
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
  if (itemPath === '/team/manage' || itemPath === '/team/menu-settings' || itemPath === '/team/admin') {
    return pathname === '/team/members' || pathname === itemPath || pathname.startsWith('/team/members/')
  }
  if (itemPath.startsWith('/team/')) {
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
  }
  return pathname === itemPath
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, token } = useAuth()
  const role = user?.role
  const showStaffReadOnlyNote = isGaStaffReadOnlyUi(role)
  const showImHealth = showInsurerManagerHealthBanner(role)
  const pathname = location.pathname
  const [imHealthErr, setImHealthErr] = useState('')
  const [imHealth, setImHealth] = useState<InsurerManagersHealth | null>(null)
  const [teamMenuManageVisible, setTeamMenuManageVisible] = useState(false)
  const [preparingNoticeOpen, setPreparingNoticeOpen] = useState(false)

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

  useEffect(() => {
    if (!token?.trim() || !user?.id) {
      setTeamMenuManageVisible(false)
      return
    }
    if (role !== 'USER' && role !== 'GA_ADMIN') {
      setTeamMenuManageVisible(false)
      return
    }
    let cancelled = false
    void fetchTeamMembers(token)
      .then((data) => {
        if (cancelled) {
          return
        }
        const oid = data.ownerId?.trim() ?? ''
        setTeamMenuManageVisible(Boolean(oid && oid === user.id))
      })
      .catch(() => {
        if (!cancelled) {
          setTeamMenuManageVisible(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.id, role])

  const menuItems = useMemo(() => {
    const base = menuForSession(role, user?.gaCode, user?.gaName)
    if (!teamMenuManageVisible) {
      return base
    }
    const out = [...base]
    const filesIdx = out.findIndex((e) => e.type === 'link' && e.path === '/team/files')
    const entry: MenuEntry = { type: 'link', label: '팀 관리', path: '/team/manage' }
    if (filesIdx >= 0) {
      out.splice(filesIdx + 1, 0, entry)
    } else {
      out.push(entry)
    }
    return out
  }, [role, user?.gaCode, user?.gaName, teamMenuManageVisible])

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
            {menuItems.map((entry, idx) => {
              if (entry.type === 'divider') {
                return (
                  <div
                    key={`menu-divider-${idx}`}
                    className="menu-card__divider my-3 border-t border-[var(--border-default)]"
                    role="presentation"
                  />
                )
              }
              const isActive =
                !entry.disabled &&
                !entry.preparing &&
                Boolean(entry.path) &&
                entry.path !== '#' &&
                pathIsActive(pathname, entry.path)
              return (
                <button
                  key={`${entry.path}-${entry.label}-${idx}`}
                  type="button"
                  className={`menu-item${isActive ? ' active' : ''}${entry.disabled ? ' menu-item--disabled' : ''}`}
                  onClick={() => {
                    if (entry.preparing) {
                      setPreparingNoticeOpen(true)
                      return
                    }
                    if (entry.disabled) {
                      setPreparingNoticeOpen(true)
                      return
                    }
                    if (!entry.path.trim() || entry.path === '#') {
                      return
                    }
                    navigate(entry.path)
                  }}
                >
                  {entry.label}
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
      </div>

      <Modal open={preparingNoticeOpen} onClose={() => setPreparingNoticeOpen(false)} ariaLabel="안내">
        <div className="text-center text-base font-medium text-[var(--text-primary)] px-2 py-2">
          준비중입니다.
        </div>
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="primary" className="min-w-[88px]" onClick={() => setPreparingNoticeOpen(false)}>
            확인
          </Button>
        </div>
      </Modal>
    </main>
  )
}
