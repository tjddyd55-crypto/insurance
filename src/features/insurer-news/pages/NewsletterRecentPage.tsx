import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterList } from '../components/NewsletterList'
import { useInsurerNewsFilters } from '../hooks/useInsurerNewsFilters'
import { getAllPublishedForGa } from '../services/insurerNews.service'
import type { NewsletterItem } from '../types'

export function NewsletterRecentPage() {
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const navigate = useNavigate()
  const [all, setAll] = useState<NewsletterItem[]>([])
  const { query, setQuery, filter, setFilter, filtered } = useInsurerNewsFilters(all)

  useEffect(() => {
    if (!gaCode) {
      return
    }
    let cancelled = false
    ;(async () => {
      const rows = await getAllPublishedForGa(gaCode, token)
      if (!cancelled) {
        setAll(rows)
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
      <h2 className="insurer-news-hub__section-title">최근 소식 전체</h2>
      <p className="insurer-news-muted">전체 보험사 소식을 최신순으로 확인합니다.</p>

      <div className="insurer-news-filters">
        <div className="insurer-news-search">
          <input
            type="search"
            placeholder="제목 · 내용 · 보험사명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="insurer-news-filters__row" role="group" aria-label="콘텐츠 유형">
          {(
            [
              ['all', '전체'],
              ['image', '이미지 포함'],
              ['pdf', 'PDF 포함'],
              ['text', '텍스트 포함'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`insurer-news-filter-chip${filter === key ? ' insurer-news-filter-chip--on' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <NewsletterList
        items={filtered}
        emptyMessage="아직 등록된 소식지가 없습니다."
        noSearchResults={filtered.length === 0 && all.length > 0}
        onOpenItem={(id) => navigate(`/portal/newsletters/${id}`)}
      />
    </>
  )
}
