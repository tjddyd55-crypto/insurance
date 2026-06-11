import MainWorkspaceLayout from '../../../../layouts/MainWorkspaceLayout'

/**
 * [Mobile 전용 View] /memo 라우트 — 정식 메뉴 페이지.
 *
 * `--mobile` modifier 는 MainWorkspaceLayout flex 높이 회귀 방지를 위해 생략한다.
 * (AGENTS.md MemoRouteMobileView 예외와 동일)
 */
export default function MemoRouteMobileView() {
  return (
    <div className="memo-route-page user-page user-page--full-bleed">
      <MainWorkspaceLayout routedMemoPage pageTitle="메모" />
    </div>
  )
}
