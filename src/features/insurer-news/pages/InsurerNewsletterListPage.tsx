import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterList } from '../components/NewsletterList'
import { getInsurersForGa, getNewslettersByInsurer } from '../services/insurerNews.service'
import type { NewsletterItem } from '../types'

export function InsurerNewsletterListPage() {
  const { insurerSlug } = useParams<{ insurerSlug: string }>()
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [insurerName, setInsurerName] = useState<string>('')

  useEffect(() => {
    if (!gaCode || !insurerSlug) {
      return
    }
    let cancelled = false
    ;(async () => {
      const insurers = await getInsurersForGa(gaCode, token)
      const match = insurers.find((x) => x.insurerSlug === insurerSlug)
      const rows = await getNewslettersByInsurer(gaCode, insurerSlug, token)
      if (!cancelled) {
        setItems(rows)
        setInsurerName(match?.insurerName ?? '')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gaCode, insurerSlug, token])

  if (!gaCode) {
    return null
  }

  return (
    <>
      <h2 className="insurer-news-hub__section-title">{insurerName || '보험사'} 소식</h2>
      <p className="insurer-news-muted">선택한 보험사의 소식지만 최신순으로 표시합니다.</p>
      <NewsletterList
        items={items}
        emptyMessage="이 보험사에 아직 등록된 소식이 없습니다."
        onOpenItem={(id) => navigate(`/portal/newsletters/${id}`)}
      />
    </>
  )
}
