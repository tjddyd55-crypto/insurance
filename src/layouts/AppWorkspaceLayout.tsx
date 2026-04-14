import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FormButton } from '../components/form'
import { Button, Modal } from '../components/ui'
import { useAuth } from '../features/auth/AuthProvider'
import {
  buildGaTenantDashboardMenu,
  GA_STAFF_MENU,
  INSURER_MANAGER_MENU,
  LOSS_ADJUSTER_MENU,
  type GaTenantDashboardMenuEntry,
  type GaTenantMenuItem,
} from '../features/dashboard/gaTenantMenu'
import { MemoWorkspaceProvider, useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import { fetchTeamMembers } from '../features/team/api/teamApi'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MemoPanel from './MemoPanel'
import { MemoElectronFabDock } from '../features/memo/components/MemoElectronFabDock'

type SidebarNavEntry = GaTenantDashboardMenuEntry

const MEMO_DEFAULT_WIDTH = 420
const MEMO_MIN_WIDTH = 320
const MEMO_MAX_WIDTH = 700

function menuItemsToEntries(items: GaTenantMenuItem[]): SidebarNavEntry[] {
  return items.map((item) => ({ type: 'link', label: item.label, path: item.path }))
}

const AUDIT_MENU: GaTenantMenuItem = { label: '보안 감사 로그', path: '/admin/audit-logs' }

const SUPER_ADMIN_MENU: GaTenantMenuItem[] = [
  { label: 'GA 관리', path: '/admin/ga' },
  { label: '담당자 관리', path: '/admin/delegates' },
  { label: '유저 관리', path: '/admin/users' },
  { label: '운영 통계', path: '/admin/analytics' },
  { label: '기능 요청 관리', path: '/internal/admin/feature-requests' },
]

function buildSidebarEntries(
  role: string | undefined,
  gaCode: string | undefined,
  gaName: string | undefined,
): SidebarNavEntry[] {
  if (role === 'SUPER_ADMIN') {
    return [
      ...menuItemsToEntries(SUPER_ADMIN_MENU),
      { type: 'link', label: AUDIT_MENU.label, path: AUDIT_MENU.path },
    ]
  }
  if (role === 'INSURER_MANAGER') {
    return menuItemsToEntries(INSURER_MANAGER_MENU)
  }
  if (role === 'LOSS_ADJUSTER') {
    return menuItemsToEntries(LOSS_ADJUSTER_MENU)
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

function isActivePath(pathname: string, itemPath: string): boolean {
  if (itemPath === '/contacts') {
    return pathname === '/contacts' || pathname === '/insurance/contacts'
  }
  if (itemPath === '/insurance/contacts') {
    return pathname === '/insurance/contacts' || pathname === '/contacts'
  }
  if (itemPath === '/portal/newsletters') {
    return pathname === '/portal/newsletters' || pathname.startsWith('/portal/newsletters/')
  }
  if (itemPath === '/portal/adjuster-news') {
    return pathname === '/portal/adjuster-news' || pathname.startsWith('/portal/adjuster-news/')
  }
  if (itemPath === '/contacts/manage') {
    return pathname === '/contacts/manage' || pathname === '/insurance/company-registry'
  }
  if (itemPath === '/insurance/company-registry') {
    return pathname === '/insurance/company-registry' || pathname.startsWith('/insurance/company-registry/')
  }
  if (itemPath.startsWith('/customers')) {
    return pathname === '/customers' || pathname.startsWith('/customers/')
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
  if (itemPath === '/loss-adjusters') {
    return pathname === '/loss-adjusters'
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
  if (itemPath === '/adjuster/news') {
    if (pathname.startsWith('/adjuster/news/upload')) {
      return false
    }
    return pathname === '/adjuster/news' || pathname.startsWith('/adjuster/news/')
  }
  if (itemPath === '/adjuster/news/upload') {
    return pathname === '/adjuster/news/upload'
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
  const { user, logout, token } = useAuth()
  const { isMinimized, setIsMinimized } = useMemoWorkspace()

  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [teamMenuManageVisible, setTeamMenuManageVisible] = useState(false)
  const [preparingNoticeOpen, setPreparingNoticeOpen] = useState(false)
  const [memoWidth, setMemoWidth] = useState(MEMO_DEFAULT_WIDTH)
  const [resizeSession, setResizeSession] = useState<{ startX: number; startWidth: number } | null>(null)

  const sidebarItems = useMemo(() => {
    const base = buildSidebarEntries(user?.role, user?.gaCode, user?.gaName).filter((entry) =>
      entry.type === 'divider' ? true : entry.path !== '/memo',
    )
    if (!teamMenuManageVisible) {
      return base
    }
    const out = [...base]
    const filesIdx = out.findIndex((entry) => entry.type === 'link' && entry.path === '/team/files')
    const teamManageEntry: SidebarNavEntry = { type: 'link', label: '팀 관리', path: '/team/manage' }
    if (filesIdx >= 0) {
      out.splice(filesIdx + 1, 0, teamManageEntry)
    } else {
      out.push(teamManageEntry)
    }
    return out
  }, [teamMenuManageVisible, user?.role, user?.gaCode, user?.gaName])

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

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) {
        return
      }
      if (!token?.trim() || !user?.id) {
        setTeamMenuManageVisible(false)
        return
      }
      if (user?.role !== 'USER' && user?.role !== 'GA_ADMIN') {
        setTeamMenuManageVisible(false)
        return
      }
      void fetchTeamMembers(token)
        .then((data) => {
          if (cancelled) {
            return
          }
          const ownerId = data.ownerId?.trim() ?? ''
          setTeamMenuManageVisible(Boolean(ownerId && ownerId === user?.id))
        })
        .catch(() => {
          if (!cancelled) {
            setTeamMenuManageVisible(false)
          }
        })
    })
    return () => {
      cancelled = true
    }
  }, [token, user?.id, user?.role])

  const clampMemoWidth = useCallback((nextWidth: number) => {
    if (nextWidth < MEMO_MIN_WIDTH) {
      return MEMO_MIN_WIDTH
    }
    if (nextWidth > MEMO_MAX_WIDTH) {
      return MEMO_MAX_WIDTH
    }
    return nextWidth
  }, [])

  const onMemoResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isFullscreen) {
        return
      }
      event.preventDefault()
      setResizeSession({ startX: event.clientX, startWidth: memoWidth })
    },
    [isFullscreen, memoWidth],
  )

  useEffect(() => {
    if (!resizeSession || isFullscreen) {
      return
    }
    const onMouseMove = (event: MouseEvent) => {
      const delta = resizeSession.startX - event.clientX
      setMemoWidth(clampMemoWidth(resizeSession.startWidth + delta))
    }
    const onMouseUp = () => {
      setResizeSession(null)
    }

    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mouseleave', onMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mouseleave', onMouseUp)
    }
  }, [clampMemoWidth, isFullscreen, resizeSession])

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
        <aside className="workspace-sidebar" aria-label="좌측 메뉴">
          <div className="workspace-sidebar__section workspace-sidebar__section--menu">
            <h2 className="workspace-sidebar__title">메뉴</h2>
            <nav className="workspace-sidebar__nav" aria-label="주요 메뉴">
              {sidebarItems.map((item, index) => {
                if (item.type === 'divider') {
                  return <div key={`workspace-divider-${index}`} className="workspace-sidebar__divider" role="presentation" />
                }
                const isDisabled = Boolean(item.disabled || item.preparing)
                const isActive =
                  !isDisabled && item.path.trim() !== '' && item.path !== '#' && isActivePath(location.pathname, item.path)
                return (
                  <FormButton
                    key={`${item.path}-${item.label}-${index}`}
                    htmlType="button"
                    variant="action"
                    className={`workspace-sidebar__nav-btn${
                      isActive ? ' workspace-sidebar__nav-btn--active' : ''
                    }`}
                    disabled={isDisabled}
                    onClick={() => {
                      if (item.preparing || item.disabled) {
                        setPreparingNoticeOpen(true)
                        return
                      }
                      if (!item.path.trim() || item.path === '#') {
                        return
                      }
                      navigate(item.path)
                    }}
                  >
                    {item.label}
                  </FormButton>
                )
              })}
            </nav>
          </div>

          <FormButton
            className="workspace-sidebar__logout"
            htmlType="button"
            variant="secondary"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            로그아웃
          </FormButton>
        </aside>

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
          style={isFullscreen ? undefined : { width: `${memoWidth}px` }}
        >
          {!isFullscreen ? (
            <div
              className="workspace-memo-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="메모 너비 조절"
              onMouseDown={onMemoResizeStart}
            />
          ) : null}
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

      <Modal open={preparingNoticeOpen} onClose={() => setPreparingNoticeOpen(false)} ariaLabel="안내">
        <div className="text-center text-base font-medium text-[var(--text-primary)] px-2 py-2">준비중입니다.</div>
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="primary" className="min-w-[88px]" onClick={() => setPreparingNoticeOpen(false)}>
            확인
          </Button>
        </div>
      </Modal>
    </>
  )
}
