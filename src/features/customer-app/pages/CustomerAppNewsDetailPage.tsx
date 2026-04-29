import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import RichTextContent from '../../../components/rich-text/RichTextContent'
import { NewsletterAttachmentList } from '../../insurer-news/components/NewsletterAttachmentList'
import CustomerAppNewsImageGallery from '../components/CustomerAppNewsImageGallery'
import { getCustomerNewsDetail, markCustomerNewsRead, type CustomerAppNewsDetail } from '../api/customerAppApi'
import { buildCustomerNewsGalleryUrls } from '../model/buildCustomerNewsGalleryUrls'
import { useCustomerAppSession } from '../session/useCustomerAppSession'

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function CustomerAppNewsDetailPage() {
  const { newsId } = useParams<{ newsId: string }>()
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [detail, setDetail] = useState<CustomerAppNewsDetail | null>(null)
  const [error, setError] = useState('')
  const hasInvalidNewsId = !newsId

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    if (hasInvalidNewsId) {
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const data = await getCustomerNewsDetail(session.appToken, String(newsId))
        await markCustomerNewsRead(session.appToken, String(newsId))
        if (!mounted) {
          return
        }
        setDetail(data)
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '소식지 상세를 불러오지 못했습니다.')
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [hasInvalidNewsId, navigate, newsId, session])

  return (
    <>
      <StatusMessage message={hasInvalidNewsId ? '잘못된 소식지 번호입니다.' : error} tone="error" />
      {!detail ? <div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div> : null}
      {detail ? (
        <article className="insurer-news-detail-article">
          <header style={{ marginBottom: 12 }} className="insurer-news-detail-text">
            <p className="insurer-news-muted" style={{ margin: '0 0 4px', fontSize: 14 }}>
              고객 소식지
            </p>
            {detail.title && detail.title !== '전체소식지' ? (
              <h2 className="insurer-news-detail-header__title" style={{ marginBottom: 8 }}>
                {detail.isPinned ? '[중요] ' : ''}
                {detail.title}
              </h2>
            ) : null}
            <time dateTime={detail.updatedAt ?? undefined} style={{ fontSize: '0.95rem' }}>
              {formatDateTime(detail.updatedAt)}
            </time>
          </header>
          <div className="customer-app-news-detail__gallery">
            <CustomerAppNewsImageGallery
              imageUrls={buildCustomerNewsGalleryUrls({
                heroImageUrl: detail.heroImageUrl,
                attachments: detail.attachments ?? [],
              })}
              altBase="고객 소식지 이미지"
            />
          </div>
          <RichTextContent
            value={detail.content || ''}
            className="insurer-news-detail-body insurer-news-detail-text rich-text-content"
            emptyText="본문이 없습니다."
          />
          <div className="insurer-news-detail-after">
            <NewsletterAttachmentList attachments={detail.attachments ?? []} />
          </div>
        </article>
      ) : null}
    </>
  )
}
