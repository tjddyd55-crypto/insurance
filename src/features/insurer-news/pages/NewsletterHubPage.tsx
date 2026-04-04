import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterCard } from '../components/NewsletterCard'
import { InsurerSelectorGrid } from '../components/InsurerSelectorGrid'
import { getInsurersForGa, getRecentNewslettersByGa } from '../services/insurerNews.service'
import type { InsurerSummary, NewsletterItem } from '../types'

export function NewsletterHubPage() {
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const navigate = useNavigate()
  const [recent, setRecent] = useState<NewsletterItem[]>([])
  const [insurers, setInsurers] = useState<InsurerSummary[]>([])

  useEffect(() => {
    if (!gaCode) {
      return
    }
    let cancelled = false
    ;(async () => {
      const [r, ins] = await Promise.all([
        getRecentNewslettersByGa(gaCode, 6, token),
        getInsurersForGa(gaCode, token),
      ])
      if (!cancelled) {
        setRecent(r)
        setInsurers(ins)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gaCode, token])

  if (!gaCode) {
    return null
  }

  return (
    <>
      <section style={{ marginBottom: 28 }}>
        <h2 className="insurer-news-hub__section-title">최근 소식</h2>
        {recent.length === 0 ? (
          <div className="insurer-news-empty">아직 등록된 소식지가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recent.map((item) => (
              <NewsletterCard key={item.id} item={item} onOpen={() => navigate(`/portal/newsletters/${item.id}`)} />
            ))}
          </div>
        )}
        <button
          type="button"
          className="button button--secondary"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/portal/newsletters/recent')}
        >
          최근 소식 전체 보기
        </button>
      </section>

      <section>
        <h2 className="insurer-news-hub__section-title">보험사별 바로가기</h2>
        <InsurerSelectorGrid
          insurers={insurers}
          onSelect={(slug) => navigate(`/portal/newsletters/insurers/${slug}`)}
          emptyMessage="연결된 보험사가 없습니다."
        />
      </section>
    </>
  )
}
