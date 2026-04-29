import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { listCustomerNews, type CustomerAppNewsListItem } from '../api/customerAppApi'
import { useCustomerAppSession } from '../session/useCustomerAppSession'

/**
 * 고객앱 홈.
 *
 * 메인 고객메시지는 설계사가 올린 이미지 소식지를 세로형 슬라이드로 노출한다.
 * 청구/문의 CTA와 하단 메뉴는 Shell에서 항상 고정 제공한다.
 */
export default function CustomerAppHomePage() {
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [error, setError] = useState('')
  const [newsList, setNewsList] = useState<CustomerAppNewsListItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

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
        setActiveIndex(0)
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '고객메시지를 불러오지 못했습니다.')
      }
    })()
    return () => {
      mounted = false
    }
  }, [navigate, session])

  const slideItems = useMemo(
    () => newsList.filter((item) => Boolean(item.heroImageUrl)).slice(0, 10),
    [newsList],
  )
  const visibleItems = slideItems.length > 0 ? slideItems : newsList.slice(0, 5)
  const activeItem = visibleItems[activeIndex] ?? null

  const moveSlide = (direction: 'prev' | 'next') => {
    if (visibleItems.length <= 1) {
      return
    }
    setActiveIndex((prev) => {
      if (direction === 'prev') {
        return prev <= 0 ? visibleItems.length - 1 : prev - 1
      }
      return prev >= visibleItems.length - 1 ? 0 : prev + 1
    })
  }

  return (
    <>
      <StatusMessage message={error} tone="error" />

      <section className="customer-app-home__message-slider" aria-label="고객메시지">
        {activeItem ? (
          <div className="customer-app-message-slide">
            <button
              type="button"
              className="customer-app-message-slide__card"
              onClick={() => navigate(`/customer-app/news/${activeItem.id}`)}
              aria-label={`${activeItem.title} 상세 보기`}
            >
              {activeItem.heroImageUrl ? (
                <img src={activeItem.heroImageUrl} alt={activeItem.title || '고객메시지'} />
              ) : (
                <div className="customer-app-message-slide__fallback">
                  <strong>{activeItem.title || '고객메시지'}</strong>
                  <span>{activeItem.summary || '담당자가 보낸 메시지입니다.'}</span>
                </div>
              )}
            </button>

            {visibleItems.length > 1 ? (
              <div className="customer-app-message-slide__controls">
                <button type="button" onClick={() => moveSlide('prev')} aria-label="이전 고객메시지">
                  이전
                </button>
                <span>{activeIndex + 1} / {visibleItems.length}</span>
                <button type="button" onClick={() => moveSlide('next')} aria-label="다음 고객메시지">
                  다음
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="customer-app-news-empty customer-app-news-empty--tall">
            표시할 고객메시지가 없습니다.
          </div>
        )}
      </section>
    </>
  )
}
