import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { NewsletterAttachmentList } from '../../insurer-news/components/NewsletterAttachmentList'
import { NewsletterImageGallery } from '../../insurer-news/components/NewsletterImageGallery'
import { getCustomerNewsDetail, markCustomerNewsRead, type CustomerAppNewsDetail } from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { readCustomerAppSession } from '../session/customerAppSession'

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
  const session = useMemo(() => readCustomerAppSession(), [])
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
    <CustomerAppShell title="소식지 상세">
      <StatusMessage message={hasInvalidNewsId ? '잘못된 소식지 번호입니다.' : error} tone="error" />
      {!detail ? <div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div> : null}
      {detail ? (
        <article className="insurer-news-detail-article">
          <header style={{ marginBottom: 16 }} className="insurer-news-detail-text">
            <p className="insurer-news-muted" style={{ margin: '0 0 4px', fontSize: 14 }}>
              고객 소식지
            </p>
            <h2 className="insurer-news-detail-header__title" style={{ marginBottom: 8 }}>
              {detail.isPinned ? '[중요] ' : ''}
              {detail.title}
            </h2>
            <time dateTime={detail.updatedAt ?? undefined} style={{ fontSize: '0.95rem' }}>
              {formatDateTime(detail.updatedAt)}
            </time>
          </header>
          <div className="insurer-news-detail-body insurer-news-detail-text" style={{ marginBottom: 8 }}>
            {detail.content || '본문이 없습니다.'}
          </div>
          <div className="insurer-news-detail-after">
            <NewsletterImageGallery
              imageUrls={
                detail.attachments?.filter((attachment) => attachment.kind === 'image').map((attachment) => attachment.url) ??
                (detail.heroImageUrl ? [detail.heroImageUrl] : [])
              }
              altBase="고객 소식지 이미지"
            />
            <NewsletterAttachmentList attachments={detail.attachments ?? []} />
          </div>
        </article>
      ) : null}
    </CustomerAppShell>
  )
}
