import { NewsletterBoardAdminView } from './NewsletterBoardAdminView'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import './newsletter-board-admin.css'

export default function NewsletterBoardAdminMobileView(props: NewsletterBoardAdminViewProps) {
  if (props.embedded) {
    return (
      <div
        className="admin-data-card ga-admin-workspace-panel--embedded newsletter-board-admin-page newsletter-board-admin-page--mobile newsletter-board-admin-page--embedded"
      >
        <NewsletterBoardAdminView {...props} />
      </div>
    )
  }
  return (
    <main className="page page--with-back newsletter-board-admin-page newsletter-board-admin-page--mobile user-page">
      <NewsletterBoardAdminView {...props} />
    </main>
  )
}
