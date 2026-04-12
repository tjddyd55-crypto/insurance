import { InsurerManagerNewsListPage } from './InsurerManagerNewsListPage'

export function LossAdjusterManagerNewsListPage() {
  return (
    <InsurerManagerNewsListPage
      channel="LOSS_ADJUSTER"
      title="손해사정사 뉴스 조회"
      subtitle="소속 손해사정사 회사에 등록된 뉴스만 표시됩니다."
      openPathPrefix="/adjuster/news"
      noSessionMessage="손해사정사 계정(소속 회사 정보 포함)으로 로그인한 후 이용할 수 있습니다."
    />
  )
}
