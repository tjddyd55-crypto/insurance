import { type RefObject } from 'react'
import { FormButton } from '../form'
import { NotificationBell } from '../../features/notification/components/NotificationBell'

type Props = {
  title: string
  showNotification: boolean
  sidebarOpen: boolean
  headerRef: RefObject<HTMLElement | null>
  onToggleSidebar: () => void
}

export default function PCHeader({
  title,
  showNotification,
  sidebarOpen,
  headerRef,
  onToggleSidebar,
}: Props) {
  return (
    <header
      ref={headerRef}
      className="app-workspace-chrome-header header pc-workspace-header"
      aria-label="PC 워크스페이스 상단"
    >
      <div className="app-workspace-chrome-header__row pc-workspace-header__row">
        <div className="pc-workspace-header__left">
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
        </div>
      </div>
    </header>
  )
}

