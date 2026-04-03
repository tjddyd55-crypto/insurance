import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useInsurerNewsAdminSession } from '../InsurerNewsAdminContext'
import { InsurerNewsForm } from '../components/InsurerNewsForm'
import { mockInsurersForGa } from '../mock/insurers'
import { getAdminNewsletterDetail, updateNewsletter } from '../services/insurerNewsAdmin.service'
import type { NewsletterDetail } from '../types'

export function InsurerNewsEditPage() {
  const { newsletterId } = useParams<{ newsletterId: string }>()
  const { session } = useInsurerNewsAdminSession()
  const navigate = useNavigate()
  const [initial, setInitial] = useState<NewsletterDetail | null | undefined>(undefined)

  useEffect(() => {
    if (!session || !newsletterId) {
      return
    }
    let cancelled = false
    ;(async () => {
      const row = await getAdminNewsletterDetail(session.gaCode, session.insurerCode, newsletterId)
      if (!cancelled) {
        setInitial(row)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, newsletterId])

  if (!session) {
    return null
  }

  const row = mockInsurersForGa(session.gaCode).find((x) => x.insurerCode === session.insurerCode)
  if (!row) {
    return <div className="insurer-news-empty">보험사 매핑을 찾을 수 없습니다.</div>
  }

  if (initial === undefined) {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <p className="insurer-news-muted">불러오는 중…</p>
      </main>
    )
  }

  if (!initial) {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <div className="insurer-news-empty">소식지를 찾을 수 없습니다.</div>
      </main>
    )
  }

  return (
    <main className="page page--with-back insurer-news-page">
      <PageBackButton />
      <InsurerNewsForm
        mode="edit"
        initial={initial}
        newsletterId={initial.id}
        context={{
          gaCode: session.gaCode,
          insurerCode: session.insurerCode,
          insurerName: session.insurerName,
          insurerSlug: row.insurerSlug,
        }}
        onCancel={() => navigate('/portal/insurer-news/dashboard')}
        onSubmit={async (draft) => {
          await updateNewsletter(draft)
          navigate('/portal/insurer-news/dashboard')
        }}
      />
    </main>
  )
}
