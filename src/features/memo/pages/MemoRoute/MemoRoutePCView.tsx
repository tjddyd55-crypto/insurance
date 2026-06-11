import MainWorkspaceLayout from '../../../../layouts/MainWorkspaceLayout'

/**
 * [PC 전용 View] /memo 라우트 — 정식 메뉴 페이지.
 * 플로팅 FAB·우측 오버레이 없이 메모 전체 영역만 표시한다.
 */
export default function MemoRoutePCView() {
  return (
    <main className="page memo-route-page memo-route-page--pc">
      <MainWorkspaceLayout routedMemoPage pageTitle="메모" />
    </main>
  )
}
