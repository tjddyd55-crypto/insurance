import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPublicExperts, type PublicAdvisorCard } from '../api/publicAdvisorApi'
import { buildAdvisorPublicPath } from '../advisorPublicRoutes'
import { AdvisorPublicImage } from '../components/AdvisorPublicImage'
import { PublicAdvisorHeader } from '../components/PublicAdvisorHeader'
import '../public-advisor.css'

const MAX_CARD_TAGS = 3

export function ExpertSearchPage() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<PublicAdvisorCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = '설계사 찾기 | ONE FC'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchPublicExperts(q)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [q])

  return (
    <div className="public-advisor-page pap-experts-page">
      <PublicAdvisorHeader />
      <div className="public-advisor-shell pap-experts-shell">
        <header className="pap-experts-hero">
          <h1 className="pap-experts-title">보험 설계사를 찾아보세요</h1>
          <p className="pap-experts-lead">이름, 소속, 지점, 해시태그로 검색할 수 있습니다.</p>
        </header>
        <div className="pap-experts-search">
          <input
            type="search"
            placeholder="이름, 소속, 지점, 해시태그로 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="설계사 검색"
          />
        </div>
        {loading ? <p className="pap-experts-hint">불러오는 중…</p> : null}
        <div className="pap-card-list pap-card-list--experts">
          {items.map((item) => {
            const verify = item.verificationBadges?.[0]
            const tags = (item.hashtags ?? []).slice(0, MAX_CARD_TAGS)
            return (
              <Link key={item.slug} to={buildAdvisorPublicPath(item.slug)} className="pap-card pap-card--expert">
                <AdvisorPublicImage
                  className="pap-card__thumb"
                  src={item.profilePhotoUrl}
                  alt=""
                />
                <div className="pap-card__body">
                  <div className="pap-card__title-row">
                    <strong className="pap-card__name">{item.displayName}</strong>
                    {verify ? <span className="pap-card__verify">{verify.label}</span> : null}
                  </div>
                  <p className="pap-affiliation pap-card__meta">
                    {[item.gaName, item.teamName].filter(Boolean).join(' · ')}
                  </p>
                  {item.officeLine ? <p className="pap-card__office">{item.officeLine}</p> : null}
                  {item.headline ? <p className="pap-card__headline">{item.headline}</p> : null}
                  {tags.length ? (
                    <div className="pap-tags pap-tags--card">
                      {tags.map((tag) => (
                        <span key={tag} className="pap-tag">#{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
        {!loading && items.length === 0 ? (
          <div className="pap-experts-empty" role="status">
            <p className="pap-experts-empty__title">검색 결과가 없습니다.</p>
            <p className="pap-experts-empty__hint">다른 이름이나 소속, 해시태그로 검색해 보세요.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ExpertSearchPage
