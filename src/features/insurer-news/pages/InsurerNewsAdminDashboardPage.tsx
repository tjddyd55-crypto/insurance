import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useInsurerNewsAdminSession } from '../InsurerNewsAdminContext'
import { InsurerNewsStats } from '../components/InsurerNewsStats'
import { NewsletterCard } from '../components/NewsletterCard'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'
import { getAdminNewsletters } from '../services/insurerNewsAdmin.service'
import type { NewsletterItem } from '../types'

export function InsurerNewsAdminDashboardPage() {
  const { session, logout } = useInsurerNewsAdminSession()
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsletterItem[]>([])

  useEffect(() => {
    if (!session) {
      return
    }
    let cancelled = false
    ;(async () => {
      const rows = await getAdminNewsletters(session.gaCode, session.insurerCode)
      if (!cancelled) {
        setItems(rows)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  if (!session) {
    return null
  }

  const last = items[0]?.publishedAt ?? null
  const lastLabel = last ? formatInsurerNewsDateTime(last) : null

  return (
    <main className="page page--with-back insurer-news-page">
      <PageBackButton />
      <header className="page-header">
        <h1>소식지 관리</h1>
        <button type="button" className="button button--secondary" style={{ marginTop: 8 }} onClick={() => logout()}>
          로그아웃 ({session.username})
        </button>
      </header>

      <InsurerNewsStats
        insurerName={session.insurerName}
        totalCount={items.length}
        lastPublishedAt={lastLabel}
      />

      <button
        type="button"
        className="button button--primary"
        style={{ marginBottom: 16 }}
        onClick={() => navigate('/portal/insurer-news/new')}
      >
        새 소식지 등록
      </button>

      <h2 className="insurer-news-hub__section-title">최근 등록한 소식지</h2>
      {items.length === 0 ? (
        <div className="insurer-news-empty">등록된 소식지가 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.slice(0, 8).map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <NewsletterCard item={item} onOpen={() => navigate(`/portal/newsletters/${item.id}`)} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => navigate(`/portal/newsletters/${item.id}`)}
                >
                  보기
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => navigate(`/portal/insurer-news/${item.id}/edit`)}
                >
                  수정
                </button>
                <button type="button" className="button button--secondary" disabled title="TODO(insurer-news): 삭제 API">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="insurer-news-muted" style={{ marginTop: 16, fontSize: 12 }}>
        게시 상태·승인 플로우는 추후 확장 예정입니다.
      </p>
    </main>
  )
}
