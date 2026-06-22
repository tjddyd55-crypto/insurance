import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FormButton } from '../components/form'
import ResponsiveLayout from '../components/ResponsiveLayout'
import PCHeader from '../components/layout/PCHeader'
import { useAuth } from '../features/auth/AuthProvider'
import { PublicAccountGaOnlyOutletGuard } from '../features/auth/PublicAccountGaOnlyOutletGuard'
import { formatGaBannerLabel, shouldShowGaTenantChrome } from '../navigation/gaTenantBarShared'
import { buildAppMenuForSession } from '../features/dashboard/gaTenantMenu'
import { isSpecialNewsletterAccount } from '../features/auth/roleGuards'
import { ExpiredBanner } from '../features/subscription/components/ExpiredBanner'
import PlatformModeSwitcher from '../features/platform/components/PlatformModeSwitcher'
import { fetchTeamMembers } from '../features/team/api/teamApi'
import { listVisibleNewsletterBoards } from '../features/insurer-news/services/insurerNews.service'
import type { DynamicNewsletterBoardMenuItem } from '../features/dashboard/gaTenantMenu'
import useIsMobile from '../hooks/useIsMobile'
import { useBackButtonClose } from '../hooks/useBackButtonClose'
import { isUserWorkspacePath } from '../features/user-ui/isUserWorkspacePath'
import { isActivePcNavigationPath } from '../components/layout/pcNavigationUtils'
import BillingStatusBadge from '../features/insurance-billing/components/BillingStatusBadge'

/** B안 모드 랜딩에서도 PlatformModeSwitcher 노출 (appRouter 변경 없음). */
function isPlatformAdminArea(pathname: string): boolean {
  return (
    pathname === '/admin/platform' ||
    pathname.startsWith('/admin/platform/') ||
    /^\/admin\/industry\/[^/]+/.test(pathname) ||
    /^\/admin\/tenant\/[^/]+/.test(pathname)
  )
}

function extractCustomerIdFromPath(path: string): string | null {
  const matched = path.match(/^\/(?:customers|customer)\/([^/?#]+)/)
  if (!matched?.[1]) {
    return null
  }
  return decodeURIComponent(matched[1])
}

export function PCLayout() {
  return <AppWorkspaceLayoutPCShell />
}

export function MobileLayout() {
  return <AppWorkspaceLayoutMobileShell />
}

/** 인증 라우트 전역: PC/모바일 레이아웃을 완전히 분리해 렌더링한다. */
export default function AppWorkspaceLayout() {
  return <ResponsiveLayout PC={PCLayout} Mobile={MobileLayout} />
}

function AppWorkspaceLayoutMobileShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, token, isAuthenticated } = useAuth()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  /*
   * 모바일 뒤로가기 UX:
   *   드로어가 열린 상태에서 브라우저/하드웨어 뒤로가기 → 드로어만 닫히고 페이지 이동은 막는다.
   *   훅 내부에서 history pushState/popstate 를 모두 캡슐화하므로 여기서는 한 줄 선언만 한다.
   */
  useBackButtonClose(drawerOpen, () => setDrawerOpen(false))

  const [mobileSelectedCustomer, setMobileSelectedCustomer] = useState<string | null>(extractCustomerIdFromPath(location.pathname))
  const [mobilePageStack, setMobilePageStack] = useState<string[]>(() => [location.pathname])
  const [teamMenuManageVisible, setTeamMenuManageVisible] = useState(false)
  const [dynamicNewsletterBoards, setDynamicNewsletterBoards] = useState<DynamicNewsletterBoardMenuItem[]>([])

  /*
   * Mobile 드로어 메뉴 구성.
   *
   * `buildAppMenuForSession` (gaTenantMenu.ts) 이 "대시보드 vs 드로어 vs PC 사이드바"
   * 공통 단일 진실 원천이다. 여기서 Mobile 용 옵션만 전달한다:
   *
   *   - `teamMenuManageVisible`: 팀 오너일 때만 "팀 관리" 항목을 `/team/files` 뒤에 주입.
   *
   * divider 는 드로어에서 시각적으로 의미가 약해 렌더 측에서 무시한다(아래 `if (item.type === 'divider') return null`).
   * 빌더 단계에서는 제거하지 않는다 — 대시보드와 동일한 엔트리 배열을 유지해 호출처 간 일관성을 보장한다.
   *
   * 메모는 `buildAppMenuForSession` 의 `/memo` 링크로 진입한다 (플로팅 FAB 없음).
   */
  const sidebarItems = useMemo(() => {
    return buildAppMenuForSession(user?.role, user?.gaCode, user?.gaName, {
      teamMenuManageVisible,
      dynamicNewsletterBoards,
      subscriptionExpired: user?.subscription?.effectiveStatus === 'EXPIRED',
    })
  }, [
    teamMenuManageVisible,
    dynamicNewsletterBoards,
    user?.role,
    user?.gaCode,
    user?.gaName,
    user?.subscription?.effectiveStatus,
  ])

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
      if (!user?.teamId?.trim()) {
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
  }, [token, user?.id, user?.role, user?.teamId])

  useEffect(() => {
    let cancelled = false
    if (!token?.trim() || (user?.role !== 'USER' && user?.role !== 'GA_ADMIN' && user?.role !== 'GA_STAFF')) {
      setDynamicNewsletterBoards([])
      return () => {
        cancelled = true
      }
    }
    void listVisibleNewsletterBoards(token)
      .then((boards) => {
        if (cancelled) {
          return
        }
        setDynamicNewsletterBoards(boards.map((board) => ({ label: board.label, slug: board.slug })))
      })
      .catch(() => {
        if (!cancelled) {
          setDynamicNewsletterBoards([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  const tenantChrome = shouldShowGaTenantChrome(isAuthenticated, user?.gaId, location.pathname)
  const isNewsManager = isSpecialNewsletterAccount(user?.role)
  const userShellActive = isUserWorkspacePath(location.pathname)
  const workspaceHeaderTitle = tenantChrome && !isNewsManager
    ? formatGaBannerLabel(user?.gaName ?? '', user?.gaCode ?? '')
    : '업무 메뉴'
  const mobileTopbarTitle = (user?.gaName ?? '').trim() || workspaceHeaderTitle || '영진 SGA'

  const pushMobilePage = useCallback((path: string) => {
    setMobilePageStack((prev) => {
      if (prev[prev.length - 1] === path) {
        return prev
      }
      return [...prev, path]
    })
  }, [])

  return (
    <div className="mobile-root mobile-workspace-layout">
      {isMobile ? (
        <header className="mobile-topbar" aria-label="모바일 상단바">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="menu-btn"
            aria-label="메뉴 열기"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            ☰
          </FormButton>
          <div className="title">{mobileTopbarTitle}</div>
          <BillingStatusBadge />
        </header>
      ) : null}

      {isPlatformAdminArea(location.pathname) && token?.trim() ? (
        <div className="platform-mode-switcher-host platform-mode-switcher-host--mobile">
          <PlatformModeSwitcher token={token} />
        </div>
      ) : null}

      {/*
       * 오버레이 드로어:
       *   - 과거에는 `<nav>` 를 `<main>` 앞에 인라인으로 렌더해 본문이 드로어 만큼
       *     아래로 밀리는 회귀가 있었다. (브라우저가 기본 block flow 로 배치)
       *   - 드로어는 "현재 보던 페이지 위에 떠 있는 네비" 여야 한다는 요구사항
       *     (모바일 앱 UX 관행) 을 만족하도록 `position: fixed` + backdrop 구조로
       *     전환한다. 본문 DOM 은 건드리지 않고 드로어가 topbar 아래부터 화면 위에 떠
       *     있으며, backdrop 을 터치하면 드로어가 닫힌다.
       *   - CSS 는 `.mobile-workspace-drawer--overlay` / `.mobile-workspace-drawer-backdrop`
       *     스코프에서 일괄 관리한다 (src/index.css).
       */}
      {drawerOpen ? (
        <div
          className="mobile-workspace-drawer-backdrop"
          role="presentation"
          aria-hidden
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      {drawerOpen ? (
        /*
         * 모바일 드로어 = [스크롤되는 메뉴 nav] + [하단 고정 footer]
         *
         * 과거에는 `<nav>` 하나에 메뉴 항목과 로그아웃을 함께 넣어서 "로그아웃이
         * 내정보 섹션 마지막 아이템 옆에 끼어 보이는" 회귀가 있었다. 구조가 한 바구니
         * 라서 CSS 로만 하단 고정을 흉내내도 섹션 소속인지 footer 인지 DOM 수준에서
         * 구분되지 않아 회귀가 되돌아왔다.
         *
         * 해결: outer 를 `<div>` 컨테이너로 두고 안에 (a) 메뉴 전담 `<nav>` · (b)
         * 세션 액션 전담 `<div class="...__footer">` 를 물리적으로 분리.
         *   - nav 는 스크롤 담당(flex:1; overflow-y:auto)
         *   - footer 는 로그아웃 같은 "메뉴 외 액션" 전용. 앞으로 여러 액션이
         *     늘어나도 이 슬롯에만 추가하면 되고 섹션 구분이 깨지지 않는다.
         *
         * aria-label 은 내부 `<nav>` 가 소유한다(의미의 주체).
         */
        <div
          className="mobile-workspace-drawer mobile-workspace-drawer--overlay"
          role="presentation"
        >
          <nav className="mobile-workspace-drawer__nav" aria-label="모바일 주요 메뉴">
            {sidebarItems.map((item, index) => {
              if (item.type === 'divider') {
                return null
              }
              if (item.type === 'section') {
                return (
                  <div
                    key={`mobile-drawer-section-${index}`}
                    className="mobile-workspace-drawer__section"
                    role="presentation"
                  >
                    {item.label}
                  </div>
                )
              }
              const isDisabled = Boolean(item.disabled || item.preparing)
              const isActive =
                !isDisabled &&
                item.path.trim() !== '' &&
                item.path !== '#' &&
                isActivePcNavigationPath(location.pathname, item.path, location.search)
              return (
                <FormButton
                  key={`${item.path}-${item.label}-${index}`}
                  htmlType="button"
                  variant="secondary"
                  className={`workspace-sidebar__menu-item${isActive ? ' workspace-sidebar__menu-item--active' : ''}`}
                  disabled={isDisabled}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    /* 개발중 항목은 클릭 비활성 (alert 없음 · 배지 라벨로만 표시) */
                    if (isDisabled) {
                      return
                    }
                    if (!item.path.trim() || item.path === '#') {
                      return
                    }
                    const nextCustomerId = extractCustomerIdFromPath(item.path)
                    setMobileSelectedCustomer(nextCustomerId)
                    pushMobilePage(item.path)
                    navigate(item.path)
                    setDrawerOpen(false)
                  }}
                >
                  <span className="workspace-sidebar__menu-item-label">{item.label}</span>
                  {item.badge ? (
                    <span className="workspace-sidebar__menu-item-badge">{item.badge}</span>
                  ) : null}
                </FormButton>
              )
            })}
          </nav>
          <div className="mobile-workspace-drawer__footer" role="presentation">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="mobile-workspace-drawer__logout"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              로그아웃
            </FormButton>
          </div>
        </div>
      ) : null}

      <main
        className={[
          'mobile-workspace-content',
          'content-wrapper',
          'content-wrapper--mobile',
          userShellActive ? 'user-app-shell' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-selected-customer={mobileSelectedCustomer ?? ''}
        data-page-stack-depth={String(mobilePageStack.length)}
      >
        <ExpiredBanner />
        <PublicAccountGaOnlyOutletGuard />
      </main>
    </div>
  )
}

function AppWorkspaceLayoutPCShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAuthenticated, token } = useAuth()
  const workspaceChromeHeaderRef = useRef<HTMLElement>(null)

  const tenantChrome = shouldShowGaTenantChrome(isAuthenticated, user?.gaId, location.pathname)
  const isNewsManager = isSpecialNewsletterAccount(user?.role)
  const userShellActive = isUserWorkspacePath(location.pathname)
  const showGaUserActions = tenantChrome && !isNewsManager
  const workspaceHeaderTitle = tenantChrome
    ? formatGaBannerLabel(user?.gaName ?? '', user?.gaCode ?? '')
    : '업무 메뉴'

  return (
    <div className="pc-root app-workspace-layout-root">
      <PCHeader
        title={workspaceHeaderTitle}
        showNotification={showGaUserActions}
        headerRef={workspaceChromeHeaderRef}
        onLogout={() => {
          logout()
          navigate('/login', { replace: true })
        }}
      />

      {isPlatformAdminArea(location.pathname) && token?.trim() ? (
        <div className="platform-mode-switcher-host platform-mode-switcher-host--pc">
          <PlatformModeSwitcher token={token} />
        </div>
      ) : null}

      <div className="workspace-root workspace-root--app-pc">
        <div className="workspace-main workspace-main--app">
          <div
            className={[
              'app-main-content',
              'app-main-content--workspace-outlet-host',
              userShellActive ? 'user-app-shell' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <ExpiredBanner />
            <PublicAccountGaOnlyOutletGuard />
          </div>
        </div>
      </div>
    </div>
  )
}
