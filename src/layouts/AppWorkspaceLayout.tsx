import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FormButton } from '../components/form'
import { useAuth } from '../features/auth/AuthProvider'
import { isCarInsuranceFeatureEnabledForGa } from '../features/dashboard/gaTenantMenu'
import { MemoWorkspaceProvider, useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MemoPanel from './MemoPanel'
import { MemoElectronFabDock } from '../features/memo/components/MemoElectronFabDock'

type SidebarNavItem = {
  label: string
  path: string
  disabled?: boolean
}

function buildSidebarItems(role: string | undefined, gaCode: string | undefined): SidebarNavItem[] {
  const carEnabled = isCarInsuranceFeatureEnabledForGa(gaCode)

  if (role === 'INSURER_MANAGER') {
    return [
      { label: '원수사 소식지', path: '/insurer/news' },
      { label: '팀 리스트', path: '/team/members' },
    ]
  }
  if (role === 'LOSS_ADJUSTER') {
    return [
      { label: '손해사정사 뉴스', path: '/adjuster/news' },
      { label: '팀 리스트', path: '/team/members' },
    ]
  }
  if (role === 'GA_STAFF') {
    return [
      { label: '원수사 연락처', path: '/insurance/company-registry' },
      { label: '원수사 담당자', path: '/insurer-managers' },
      { label: '손해사정사 계정', path: '/loss-adjusters' },
      { label: '원수사 소식지', path: '/portal/newsletters' },
      { label: '팀 리스트', path: '/team/members' },
    ]
  }

  return [
    { label: '고객관리', path: '/customers' },
    { label: '원수사 연락처', path: '/insurance/contacts' },
    { label: '원수사 소식지', path: '/portal/newsletters' },
    {
      label: '자동차 신청서',
      path: '/application',
      disabled: !carEnabled,
    },
    { label: '팀 리스트', path: '/team/members' },
  ]
}

function isActivePath(pathname: string, itemPath: string): boolean {
  if (itemPath === '/customers') {
    return pathname === '/customers' || pathname.startsWith('/customers/')
  }
  if (itemPath === '/portal/newsletters') {
    return pathname === '/portal/newsletters' || pathname.startsWith('/portal/newsletters/')
  }
  if (itemPath === '/application') {
    return pathname === '/application' || pathname.startsWith('/application/')
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

/** 인증 라우트 전역: 기본은 좌측 메뉴+우측 콘텐츠, 고객관리는 좌측 고객 워크스페이스로 전환 */
export default function AppWorkspaceLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <MemoWorkspaceProvider>
      <AppWorkspaceLayoutShell isMobile={isMobile} />
    </MemoWorkspaceProvider>
  )
}

function AppWorkspaceLayoutShell({ isMobile }: { isMobile: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { isMinimized, setIsMinimized } = useMemoWorkspace()

  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const sidebarItems = useMemo(
    () => buildSidebarItems(user?.role, user?.gaCode),
    [user?.role, user?.gaCode],
  )
  const isCustomerWorkspace = location.pathname === '/customers' || location.pathname.startsWith('/customers/')

  const onSelectNoteFromList = useCallback((id: string) => {
    setSelectedNoteId(id)
  }, [])

  const onToggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => {
      const next = !v
      if (next) {
        setIsMemoOpen(true)
      }
      return next
    })
  }, [])

  const onToggleMinimize = useCallback(() => {
    setIsMemoOpen(true)
    setIsMinimized((prev) => {
      const next = !prev
      if (next) {
        setIsFullscreen(false)
      }
      return next
    })
  }, [setIsMinimized])

  useEffect(() => {
    if (isFullscreen) {
      setIsMinimized(false)
    }
  }, [isFullscreen, setIsMinimized])

  if (isMobile) {
    return (
      <div className="app-main-content">
        <Outlet />
        <MemoElectronFabDock
          isMobile
          onToggleMinimize={onToggleMinimize}
          onToggleFullscreen={onToggleFullscreen}
        />
      </div>
    )
  }

  const showMemoPanel = isMemoOpen && !isMinimized

  return (
    <>
      <div className="workspace-root workspace-root--app-pc">
        {!isCustomerWorkspace ? (
          <aside className="workspace-sidebar" aria-label="좌측 메뉴">
            <div className="workspace-sidebar__section">
              <h2 className="workspace-sidebar__title">메뉴</h2>
              <nav className="workspace-sidebar__nav">
                {sidebarItems.map((item) => (
                  <FormButton
                    key={item.path}
                    htmlType="button"
                    variant="action"
                    className={`workspace-sidebar__nav-btn${
                      isActivePath(location.pathname, item.path) ? ' workspace-sidebar__nav-btn--active' : ''
                    }`}
                    disabled={item.disabled}
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </FormButton>
                ))}
              </nav>
            </div>
          </aside>
        ) : null}

        <div className="workspace-main workspace-main--app">
          <div className="app-main-content">
            <Outlet />
          </div>
        </div>
      </div>

      {!isMemoOpen ? (
        <FormButton
          htmlType="button"
          variant="action"
          className="workspace-memo-reopen"
          onClick={() => setIsMemoOpen(true)}
        >
          메모 패널 열기
        </FormButton>
      ) : null}

      {showMemoPanel ? (
        <div
          className={`workspace-memo-overlay${isFullscreen ? ' workspace-memo-overlay--fullscreen' : ''}`}
          role="complementary"
          aria-label="메모 도구"
        >
          <MemoPanel
            isFullscreen={isFullscreen}
            isListOpen={isListOpen}
            onToggleList={() => setIsListOpen((v) => !v)}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
          />
        </div>
      ) : null}

      <MemoElectronFabDock
        isMobile={false}
        onToggleMinimize={onToggleMinimize}
        onToggleFullscreen={onToggleFullscreen}
      />
    </>
  )
}
