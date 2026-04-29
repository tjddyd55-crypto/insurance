import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import RichTextContent from '../../../components/rich-text/RichTextContent'
import { listCustomerNews, type CustomerAppNewsListItem } from '../api/customerAppApi'
import { useCustomerAppSession } from '../session/useCustomerAppSession'

function normalizeSlideTitle(title?: string | null): string {
  const value = String(title ?? '').trim()
  if (!value || value === '전체소식지') {
    return '소식·메시지'
  }
  return value
}

export default function CustomerAppHomePage() {
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [error, setError] = useState('')
  const [newsList, setNewsList] = useState<CustomerAppNewsListItem[]>([])

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
        setNewsList(news)
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

      <section className="customer-app-home__news customer-app-home__news--edge" aria-label="고객 메시지 슬라이드">
        {newsList.length === 0 && !error ? (
          <div className="customer-app-news-empty">표시할 소식지가 없습니다.</div>
        ) : null}

        {newsList.length > 0 ? (
          <div className="customer-app-home-slider">
            <div className="customer-app-home-slider__track">
              {newsList.map((item) => {
                const body = String(item.summary ?? '').trim()
                const hero = item.heroImageUrl?.trim() || null
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="customer-app-home-slider__slide"
                    onClick={() => navigate(`/customer-app/news/${item.id}`)}
                  >
                    <div className="customer-app-home-slider__card">
                      {hero ? (
                        <div className="customer-app-home-slider__media">
                          <img src={hero} alt="" loading="lazy" />
                        </div>
                      ) : (
                        <div className="customer-app-home-slider__fallback">
                          <div className="customer-app-home-slider__fallback-title">
                            {normalizeSlideTitle(item.title)}
                          </div>
                          <RichTextContent
                            value={body}
                            className="customer-app-home-slider__fallback-body"
                            emptyText="내용이 없습니다. 탭하면 상세를 확인할 수 있습니다."
                          />
                        </div>
                      )}
                      <div className="customer-app-home-slider__caption">
                        {normalizeSlideTitle(item.title)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="customer-app-home__news-more">
          <Link to="/customer-app/news/all" className="customer-app-home__news-more-link">
            전체 소식지 보기 &gt;
          </Link>
        </div>
      </section>
    </>
  )
}
