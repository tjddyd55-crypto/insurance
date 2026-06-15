import { NewsletterBoardAdminView } from './NewsletterBoardAdminView'
import type { NewsletterBoardAdminViewProps } from './newsletterBoardAdminViewProps'
import './newsletter-board-admin.css'

export default function NewsletterBoardAdminPCView(props: NewsletterBoardAdminViewProps) {
  return (
    <main className="page page--with-back newsletter-board-admin-page newsletter-board-admin-page--pc user-page">
      <NewsletterBoardAdminView {...props} />
    </main>
  )
}
