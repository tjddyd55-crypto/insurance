import { Link } from 'react-router-dom'
import MainWorkspaceLayout from '../../../../layouts/MainWorkspaceLayout'

/**
 * [Mobile 전용 View] /memo 라우트 — 모바일 기기 화면.
 *
 * 이 View 의 책임: 모바일 UI 마크업 + 모바일 전용 className 부착만.
 * 모바일 레이아웃에는 전역 메모 패널이 상시 붙어있지 않으므로,
 * 이 화면에서 직접 `MainWorkspaceLayout` 로 좌(placeholder)·우(메모) 구성을 만든다.
 *
 *  - 라우팅·분기:   ../MemoRoutePage.tsx (container)
 *  - PC 대응:       ./MemoRoutePCView.tsx
 *  - 메모 UI·상태:  features/memo/** · layouts/MainWorkspaceLayout
 *
 * 스타일 조정은 src/index.css 의 `.memo-route-page--mobile` 스코프에서 한다.
 * 이 컴포넌트 안에서 PC 분기 (`useIsMobile` 등) 를 호출하지 않는다
 * (`MainWorkspaceLayout` 내부는 전역 레이아웃 예외 영역이라 자체 판단 허용).
 */
export default function MemoRouteMobileView() {
  return (
    <main className="page memo-route-page memo-route-page--mobile">
      <MainWorkspaceLayout>
        <div className="p-4 space-y-3">
          <h1 className="text-lg font-bold">업무 영역</h1>
          <p className="text-sm text-[var(--text-muted)]">
            우측에서 메모를 사용합니다. 다른 화면으로 이동하려면 아래 링크를 사용하세요.
          </p>
          <Link to="/dashboard" className="text-blue-400 hover:underline">
            대시보드로 이동
          </Link>
        </div>
      </MainWorkspaceLayout>
    </main>
  )
}
