import { NewsletterBoardAdminView } from './NewsletterBoardAdminView'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'

export default function NewsletterBoardAdminMobileView(props: NewsletterBoardAdminViewProps) {
  return (
    <main className="page page--with-back newsletter-board-admin-page newsletter-board-admin-page--mobile user-page">
      <NewsletterBoardAdminView {...props} />
    </main>
  )
}
