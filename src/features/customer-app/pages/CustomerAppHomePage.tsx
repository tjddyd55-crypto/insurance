import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { listCustomerNews, type CustomerAppNewsListItem } from '../api/customerAppApi'
import CustomerAppNewsCard from '../components/CustomerAppNewsCard'
import { useCustomerAppSession } from '../session/useCustomerAppSession'

/**
 * 고객앱 메인 화면.
 *
 * 설계 의도:
 *   - 청구 요청은 Shell 하단 CTA에서 공통 제공.
 *   - 최신 전체소식지 1건은 고객 홍보 카드로 크게 노출.
 *   - 개인메시지/요청내역/내정보는 하단 탭바(Shell)에서 접근.
 */
export default function CustomerAppHomePage() {
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [error, setError] = useState('')
  const [latestNews, setLatestNews] = useState<CustomerAppNewsListItem | null>(null)

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    let mounted = true
    void (async () => {
      try {
        const news = await listCustomerNews(session.appToken)
        if (!mounted) {
          return
        }
        setLatestNews(news.length > 0 ? news[0] : null)
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '소식지 정보를 불러오지 못했습니다.')
      }
    })()
    return () => {
      mounted = false
    }
  }, [navigate, session])

  return (
    <>
      <StatusMessage message={error} tone="error" />

      <section className="customer-app-home__news" aria-label="최신 소식지">
        {latestNews ? (
          <CustomerAppNewsCard
            id={latestNews.id}
            title={latestNews.title}
            summary={latestNews.summary}
            updatedAt={latestNews.updatedAt}
            heroImageUrl={latestNews.heroImageUrl ?? null}
            label="소식지"
            variant="featured"
            onOpen={() => navigate(`/customer-app/news/${latestNews.id}`)}
          />
        ) : (
          <div className="customer-app-news-empty">표시할 소식지가 없습니다.</div>
        )}
        <div className="customer-app-home__news-more">
          <Link to="/customer-app/news/all" className="customer-app-home__news-more-link">
            전체 소식지 보기 &gt;
          </Link>
        </div>
      </section>
    </>
  )
}
