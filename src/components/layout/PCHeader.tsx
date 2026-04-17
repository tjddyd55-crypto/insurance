import { type RefObject } from 'react'
import { FormButton } from '../form'
import { NotificationBell } from '../../features/notification/components/NotificationBell'

type Props = {
  title: string
  showNotification: boolean
  sidebarOpen: boolean
  headerRef: RefObject<HTMLElement | null>
  onBack: () => void
  onToggleSidebar: () => void
}

export default function PCHeader({
  title,
  showNotification,
  sidebarOpen,
  headerRef,
  onBack,
  onToggleSidebar,
}: Props) {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  const active = Boolean(api?.minimize && api?.maximize && api?.close)

  return (
    <header
      ref={headerRef}
      className="app-workspace-chrome-header header pc-workspace-header"
      aria-label="PC 워크스페이스 상단"
    >
      <div className="app-workspace-chrome-header__row pc-workspace-header__row">
        <div className="pc-workspace-header__left">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="back-btn pc-workspace-header__back-btn"
            aria-label="뒤로가기"
            onClick={onBack}
          >
            ←
          </FormButton>
          <div className="header-left app-workspace-chrome-header__leading">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="menu-btn app-workspace-chrome-header__menu-btn"
              aria-label="메뉴 접기·펼치기"
              aria-expanded={sidebarOpen}
              onClick={onToggleSidebar}
            >
              ☰
            </FormButton>
            <span className="ga-name app-workspace-chrome-header__ga">{title}</span>
          </div>
        </div>

        <div className="pc-workspace-header__right">
          {showNotification ? <NotificationBell variant="workspaceHeader" boundaryRef={headerRef} /> : null}
          <div className="pc-workspace-header__window-controls" aria-label="윈도우 제어">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="pc-workspace-header__win-btn"
              aria-label="최소화"
              onClick={() => api?.minimize?.()}
              disabled={!active}
            >
              —
            </FormButton>
            <FormButton
              htmlType="button"
              variant="secondary"
              className="pc-workspace-header__win-btn"
              aria-label="최대화 또는 복원"
              onClick={() => api?.maximize?.()}
              disabled={!active}
            >
              {'\u25A1'}
            </FormButton>
            <FormButton
              htmlType="button"
              variant="secondary"
              className="pc-workspace-header__win-btn pc-workspace-header__win-btn--close"
              aria-label="닫기"
              onClick={() => api?.close?.()}
              disabled={!active}
            >
              {'\u2715'}
            </FormButton>
          </div>
        </div>
      </div>
    </header>
  )
}

