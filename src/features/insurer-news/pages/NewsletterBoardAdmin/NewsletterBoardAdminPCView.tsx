import { NewsletterBoardAdminView } from './NewsletterBoardAdminView'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import './newsletter-board-admin.css'

export default function NewsletterBoardAdminPCView(props: NewsletterBoardAdminViewProps) {
  if (props.embedded) {
    return (
      <div
        className="admin-data-card ga-admin-workspace-panel--embedded newsletter-board-admin-page newsletter-board-admin-page--pc newsletter-board-admin-page--embedded"
      >
        <NewsletterBoardAdminView {...props} />
      </div>
    )
  }
  return (
    <main className="page page--with-back newsletter-board-admin-page newsletter-board-admin-page--pc user-page">
      <NewsletterBoardAdminView {...props} />
    </main>
  )
}
