import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import RichTextContent from '../../../components/rich-text/RichTextContent'
import CustomerAppNewsImageGallery from '../components/CustomerAppNewsImageGallery'
import {
  getCustomerNewsDetail,
  listCustomerNews,
  type CustomerAppNewsListItem,
} from '../api/customerAppApi'
import { buildCustomerNewsGalleryUrls } from '../model/buildCustomerNewsGalleryUrls'
import { useCustomerAppSession } from '../session/useCustomerAppSession'

function newsListTime(iso: string | null | undefined): number {
  if (!iso) {
    return 0
  }
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

function pickLatestHomeNewsListItem(rows: CustomerAppNewsListItem[]): CustomerAppNewsListItem | null {
  const scopeAll = rows.filter((row) => row.scope !== 'personal')
  if (scopeAll.length === 0) {
    return null
  }
  return [...scopeAll].sort((a, b) => newsListTime(b.updatedAt) - newsListTime(a.updatedAt))[0]
}

export default function CustomerAppHomePage() {
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [homeNewsId, setHomeNewsId] = useState<string | null>(null)
  /** 최신 활성 홈 세트 1건의 이미지 URL (hero + attachments 이미지, 중복 제거) */
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [summaryText, setSummaryText] = useState('')
  const [slideTitle, setSlideTitle] = useState('')

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    let mounted = true
    setLoading(true)
    void (async () => {
      try {
        const list = await listCustomerNews(session.appToken)
        if (!mounted) {
          return
        }
        const latest = pickLatestHomeNewsListItem(list)
        if (!latest) {
          setHomeNewsId(null)
          setGalleryUrls([])
          setSummaryText('')
          setSlideTitle('')
          setError('')
          return
        }
        const detail = await getCustomerNewsDetail(session.appToken, latest.id)
        if (!mounted) {
          return
        }
        const urls = buildCustomerNewsGalleryUrls({
          heroImageUrl: detail.heroImageUrl,
          attachments: detail.attachments,
        })
        setHomeNewsId(latest.id)
        setGalleryUrls(urls)
        setSummaryText(String(detail.content ?? '').trim())
        setSlideTitle(String(detail.title ?? '').trim())
        setError('')
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '소식지 정보를 불러오지 못했습니다.')
        setHomeNewsId(null)
        setGalleryUrls([])
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [navigate, session])

  const openDetail = () => {
    if (homeNewsId) {
      navigate(`/customer-app/news/${homeNewsId}`)
    }
  }

  return (
    <>
      <StatusMessage message={error} tone="error" />

      <section className="customer-app-home__news customer-app-home__news--edge" aria-label="고객 메시지 슬라이드">
        {loading ? <div className="customer-app-news-empty customer-app-home__loading">불러오는 중…</div> : null}

        {!loading && !homeNewsId && !error ? (
          <div className="customer-app-news-empty">등록된 고객 메시지가 없습니다.</div>
        ) : null}

        {!loading && galleryUrls.length > 0 ? (
          <CustomerAppNewsImageGallery
            key={galleryUrls.join('|')}
            imageUrls={galleryUrls}
            altBase="고객 메시지 이미지"
            className="customer-app-news-gallery--home"
            alwaysShowPager
          />
        ) : null}

        {!loading && homeNewsId && galleryUrls.length === 0 && summaryText ? (
          <button
            type="button"
            className="customer-app-home__text-fallback"
            onClick={openDetail}
          >
            <div className="customer-app-home__text-fallback-inner">
              {slideTitle ? <div className="customer-app-home__text-fallback-title">{slideTitle}</div> : null}
              <RichTextContent
                value={summaryText}
                className="customer-app-home__text-fallback-body"
                emptyText="내용이 없습니다."
              />
              <span className="customer-app-home__text-fallback-hint">탭하여 상세 보기</span>
            </div>
          </button>
        ) : null}

        {homeNewsId ? (
          <div className="customer-app-home__detail-link">
            <Link to={`/customer-app/news/${homeNewsId}`} className="customer-app-home__detail-link-a">
              메시지 상세 보기
            </Link>
          </div>
        ) : null}
      </section>
    </>
  )
}
