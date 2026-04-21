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
 * ---
 *
 * ⚠️ 루트 요소는 반드시 `<div className="memo-route-page ...">` 형태를 유지한다.
 *
 * `MainWorkspaceLayout` 은 내부에 자체 `workspace-root` flex 컨테이너를 갖는
 * "메모 작업 공간 전용" 레이아웃이다. 여기에 공용 `.page` 클래스(→ `max-width`,
 * `padding` 등 일반 페이지 기본값) 를 덧입히면 `workspace-root` 의 flex 높이·
 * 여백 계산이 어긋나 메모 패널이 원래 위치에서 찌그러진다(회귀 사례).
 *
 * 이 경우엔 "공용 `.page` 스캐폴딩을 타지 않는 예외 화면" 이 맞고,
 * PC/Mobile 구분을 위한 `--mobile` modifier 만 붙여도 규칙 §8-2 원칙 2 를 만족한다.
 *
 * 스타일 조정은 src/index.css 의 `.memo-route-page--mobile` 스코프에서 한다.
 * 이 컴포넌트 안에서 PC 분기 (`useIsMobile` 등) 를 호출하지 않는다
 * (`MainWorkspaceLayout` 내부는 전역 레이아웃 예외 영역이라 자체 판단 허용).
 */
export default function MemoRouteMobileView() {
  return (
    <div className="memo-route-page memo-route-page--mobile">
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
    </div>
  )
}
