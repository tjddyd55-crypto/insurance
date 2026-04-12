import { NewsletterHubPage } from './NewsletterHubPage'

export function LossAdjusterNewsletterHubPage() {
  return (
    <NewsletterHubPage
      channel="LOSS_ADJUSTER"
      detailBasePath="/portal/adjuster-news"
      emptyMessage="아직 등록된 손해사정사 뉴스가 없습니다."
    />
  )
}
