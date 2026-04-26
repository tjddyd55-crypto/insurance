import { type RefObject } from 'react'
import { FormButton } from '../form'
import { NotificationBell } from '../../features/notification/components/NotificationBell'
import PCTopNavigation from './PCTopNavigation'

type Props = {
  title: string
  showNotification: boolean
  headerRef: RefObject<HTMLElement | null>
  onLogout?: () => void
}

/**
 * PCHeader
 *
 * PC 전용 상단 업무 헤더.
 *
 * 책임:
 * - 현재 GA/업무 제목 표시
 * - 알림 버튼 표시
 * - PC 세션 액션(로그아웃) 표시
 * - PC 상단 고정 메뉴(PCTopNavigation) 표시
 *
 * 하지 않는 일:
 * - 모바일 상단바를 렌더링하지 않는다.
 * - 좌측 사이드바 메뉴를 렌더링하지 않는다.
 * - 페이지 본문 배치를 담당하지 않는다.
 */
export default function PCHeader({
  title,
  showNotification,
  headerRef,
  onLogout,
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
            <span className="ga-name app-workspace-chrome-header__ga">{title}</span>
          </div>
        </div>

        <div className="pc-workspace-header__right">
          {showNotification ? <NotificationBell variant="workspaceHeader" boundaryRef={headerRef} /> : null}
          {onLogout ? (
            <FormButton
              htmlType="button"
              variant="secondary"
              className="pc-workspace-header__logout"
              onClick={onLogout}
            >
              로그아웃
            </FormButton>
          ) : null}
        </div>
      </div>

      <PCTopNavigation />
    </header>
  )
}

