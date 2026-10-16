import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPublicExperts, type PublicAdvisorCard } from '../api/publicAdvisorApi'
import { buildAdvisorPublicPath } from '../advisorPublicRoutes'
import '../public-advisor.css'

export function ExpertSearchPage() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<PublicAdvisorCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = '보험 설계사 찾기 | ONE FC'
    const meta = document.querySelector('meta[name="robots"]')
    if (meta) meta.setAttribute('content', 'index,follow')
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
    <div className="public-advisor-page">
      <div className="public-advisor-shell">
        <h1>보험 설계사를 찾아보세요</h1>
        <p className="pap-affiliation">이름, 소속, 지점, 사무실 위치, 해시태그로 검색할 수 있습니다.</p>
        <div className="pap-experts-search">
          <input
            type="search"
            placeholder="검색어 입력"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="설계사 검색"
          />
        </div>
        {loading ? <p>불러오는 중…</p> : null}
        <div className="pap-card-list">
          {items.map((item) => (
            <Link key={item.slug} to={buildAdvisorPublicPath(item.slug)} className="pap-card">
              {item.profilePhotoUrl ? (
                <img className="pap-card__thumb" src={item.profilePhotoUrl} alt="" />
              ) : (
                <div className="pap-card__thumb" aria-hidden />
              )}
              <div>
                <strong>{item.displayName}</strong>
                <p className="pap-affiliation">
                  {[item.gaName, item.teamName].filter(Boolean).join(' · ')}
                </p>
                <p className="pap-headline">{item.headline || item.officeLine}</p>
              </div>
              <span aria-hidden>›</span>
            </Link>
          ))}
        </div>
        {!loading && items.length === 0 ? <p>검색 결과가 없습니다.</p> : null}
      </div>
    </div>
  )
}

export default ExpertSearchPage
