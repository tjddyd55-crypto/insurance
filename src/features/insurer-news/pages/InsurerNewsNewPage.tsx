import { useNavigate } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useInsurerNewsAdminSession } from '../InsurerNewsAdminContext'
import { InsurerNewsForm } from '../components/InsurerNewsForm'
import { mockInsurersForGa } from '../mock/insurers'
import { createNewsletter } from '../services/insurerNewsAdmin.service'

export function InsurerNewsNewPage() {
  const { session } = useInsurerNewsAdminSession()
  const navigate = useNavigate()

  if (!session) {
    return null
  }

  const row = mockInsurersForGa(session.gaCode).find((x) => x.insurerCode === session.insurerCode)
  if (!row) {
    return <div className="insurer-news-empty">보험사 매핑을 찾을 수 없습니다.</div>
  }

  return (
    <main className="page page--with-back insurer-news-page">
      <PageBackButton />
      <InsurerNewsForm
        mode="create"
        initial={null}
        context={{
          gaCode: session.gaCode,
          insurerCode: session.insurerCode,
          insurerName: session.insurerName,
          insurerSlug: row.insurerSlug,
        }}
        onCancel={() => navigate('/portal/insurer-news/dashboard')}
        onSubmit={async (draft) => {
          await createNewsletter(draft)
          navigate('/portal/insurer-news/dashboard')
        }}
      />
    </main>
  )
}
