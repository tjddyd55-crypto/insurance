import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FormButton } from '../components/form'
import { useAuth } from '../features/auth/AuthProvider'
import { isCarInsuranceFeatureEnabledForGa } from '../features/dashboard/gaTenantMenu'
import { MemoWorkspaceProvider, useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MemoPanel from './MemoPanel'
import { MemoElectronFabDock } from '../features/memo/components/MemoElectronFabDock'

const MEMO_MIN_WIDTH = 240
const MEMO_MAX_WIDTH = 600
const MEMO_DEFAULT_WIDTH = 340

type SidebarNavItem = {
  label: string
  path: string
  disabled?: boolean
}

function buildSidebarItems(role: string | undefined, gaCode: string | undefined): SidebarNavItem[] {
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
      { label: '팀 리스트', path: '/team/members' },
    ]
  }

  const items: SidebarNavItem[] = [
    { label: '고객관리', path: '/customers' },
    { label: '원수사 연락처', path: '/insurance/contacts' },
    { label: '원수사 소식지', path: '/portal/newsletters' },
    {
      label: '자동차 신청서',
      path: '/application',
      disabled: !isCarInsuranceFeatureEnabledForGa(gaCode),
    },
    { label: '팀 리스트', path: '/team/members' },
  ]
  return items
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

/**
 * 인증 라우트 전역: 좌측 사이드바 + 메인 작업영역 + 우측 메모 패널 구조를 제공합니다.
 */
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
  const { token, addNote, handleAutoArrange, isMinimized, setIsMinimized } = useMemoWorkspace()

  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [memoWidth, setMemoWidth] = useState(MEMO_DEFAULT_WIDTH)
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const sidebarItems = useMemo(
    () => buildSidebarItems(user?.role, user?.gaCode),
    [user?.role, user?.gaCode],
  )

  const clampMemoWidth = useCallback((next: number) => {
    return Math.max(MEMO_MIN_WIDTH, Math.min(MEMO_MAX_WIDTH, next))
  }, [])

  const onMemoResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizeStartRef.current = {
      startX: event.clientX,
      startWidth: memoWidth,
    }
  }, [memoWidth])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const start = resizeStartRef.current
      if (!start) {
        return
      }
      const dx = event.clientX - start.startX
      const nextWidth = clampMemoWidth(start.startWidth - dx)
      setMemoWidth(nextWidth)
    }

    const handleMouseUp = () => {
      resizeStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [clampMemoWidth])

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
    <div className={`workspace-root workspace-root--app-pc${isFullscreen ? ' workspace-root--memo-fullscreen' : ''}`}>
      {!isFullscreen ? (
        <aside className="workspace-sidebar" aria-label="좌측 사이드바">
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
          <div className="workspace-sidebar__section workspace-sidebar__section--memo-tools">
            <h2 className="workspace-sidebar__title">메모 도구</h2>
            <div className="workspace-sidebar__memo-actions">
              <FormButton
                htmlType="button"
                variant="action"
                className="workspace-sidebar__memo-btn"
                disabled={!token?.trim()}
                onClick={() => void addNote()}
              >
                메모 추가
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="workspace-sidebar__memo-btn"
                disabled={!token?.trim()}
                onClick={() => setIsListOpen((v) => !v)}
              >
                메모 목록 {isListOpen ? '숨기기' : '열기'}
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="workspace-sidebar__memo-btn"
                disabled={!token?.trim()}
                onClick={handleAutoArrange}
              >
                정리하기
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="workspace-sidebar__memo-btn"
                onClick={() => {
                  setIsMemoOpen((prev) => {
                    const next = !prev
                    if (next) {
                      setIsMinimized(false)
                    }
                    return next
                  })
                }}
              >
                메모 {isMemoOpen ? '닫기' : '열기'}
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="workspace-sidebar__memo-btn"
                onClick={onToggleFullscreen}
              >
                전체화면 {isFullscreen ? '해제' : '전환'}
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="workspace-sidebar__memo-btn"
                onClick={onToggleMinimize}
              >
                최소화 {isMinimized ? '해제' : '전환'}
              </FormButton>
            </div>
          </div>
        </aside>
      ) : null}

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

      {!isFullscreen ? (
        <div className="workspace-main workspace-main--app">
          <div className="app-main-content">
            <Outlet />
          </div>
        </div>
      ) : null}

      {showMemoPanel && !isFullscreen ? (
        <div
          className="workspace-memo-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="메모 폭 조절"
          onMouseDown={onMemoResizeStart}
        />
      ) : null}

      {showMemoPanel ? (
        <div
          className={`workspace-memo-panel${isFullscreen ? ' workspace-memo-panel--fullscreen' : ''}`}
          role="complementary"
          aria-label="메모 도구"
          style={!isFullscreen ? { width: memoWidth } : undefined}
        >
          <MemoPanel
            isFullscreen={isFullscreen}
            isListOpen={isListOpen}
            onToggleList={() => setIsListOpen((v) => !v)}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
            showListToggle={false}
          />
        </div>
      ) : null}

      {!isFullscreen ? null : (
        <FormButton
          htmlType="button"
          variant="action"
          className="workspace-memo-fullscreen-exit"
          onClick={onToggleFullscreen}
        >
          메모 전체화면 닫기
        </FormButton>
      )}
    </div>
  )
}
