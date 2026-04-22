import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import { NewsletterList } from '../../insurer-news/components/NewsletterList'
import type { NewsletterItem } from '../../insurer-news/types'
import { listCustomerNews, type CustomerAppNewsListItem } from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { readCustomerAppSession } from '../session/customerAppSession'

/**
 * 고객앱 메인 화면.
 *
 * 설계 의도:
 *   - 첫 화면에서 노출되는 액션의 우선순위는 "청구 요청하기" 하나.
 *   - 소식지는 자연 노출만. 최신 1건만 보여주고 더보기는 텍스트 링크로 배치.
 *   - 개인메시지/요청내역/내정보는 하단 탭바(Shell) 에서 접근.
 *
 * NewsletterList 를 그대로 재사용하되 items 는 최대 1건으로 제한해
 * 기존 카드 UI 를 건드리지 않고 "최신 1건" UX 를 달성한다.
 */

const EMPTY_NEWSLETTER: NewsletterItem[] = []

function toNewsletterItem(row: CustomerAppNewsListItem): NewsletterItem {
  return {
    id: row.id,
    gaCode: 'customer-app',
    insurerCode: 'customer-news',
    insurerName: '소식지',
    insurerSlug: row.scope ?? 'all',
    title: row.title,
    summary: row.summary,
    heroImageUrl: row.heroImageUrl ?? null,
    publishedAt: row.updatedAt ?? new Date().toISOString(),
    status: 'PUBLISHED',
    hasImages: Boolean(row.heroImageUrl),
    hasPdf: false,
    hasTextBody: Boolean(row.summary?.trim()),
  }
}

export default function CustomerAppHomePage() {
  const navigate = useNavigate()
  const session = readCustomerAppSession()
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

  const newsletterItems = useMemo<NewsletterItem[]>(
    () => (latestNews ? [toNewsletterItem(latestNews)] : EMPTY_NEWSLETTER),
    [latestNews],
  )

  return (
    <CustomerAppShell title="홈">
      <StatusMessage message={error} tone="error" />

      <section className="customer-app-home__news" aria-label="최신 소식지">
        <NewsletterList
          items={newsletterItems}
          emptyMessage="표시할 소식지가 없습니다."
          variant="mobile"
          onOpenItem={(id) => navigate(`/customer-app/news/${id}`)}
        />
        <div className="customer-app-home__news-more">
          <Link to="/customer-app/news/all" className="customer-app-home__news-more-link">
            전체 소식지 보기 &gt;
          </Link>
        </div>
      </section>

      <div className="customer-app-home__cta">
        <FormButton
          htmlType="button"
          variant="primary"
          className="customer-app-home__cta-button"
          onClick={() => navigate('/customer-app/requests/new')}
        >
          청구 요청하기
        </FormButton>
      </div>
    </CustomerAppShell>
  )
}
