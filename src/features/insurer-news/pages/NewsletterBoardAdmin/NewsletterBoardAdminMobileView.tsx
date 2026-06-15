import { NewsletterBoardAdminView } from './NewsletterBoardAdminView'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import './newsletter-board-admin.css'

export default function NewsletterBoardAdminMobileView(props: NewsletterBoardAdminViewProps) {
  return (
    <main className="page page--with-back newsletter-board-admin-page newsletter-board-admin-page--mobile user-page">
      <NewsletterBoardAdminView {...props} />
    </main>
  )
}
