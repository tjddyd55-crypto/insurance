import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterAttachmentList } from '../components/NewsletterAttachmentList'
import { NewsletterImageGallery } from '../components/NewsletterImageGallery'
import { getNewsletterDetail } from '../services/insurerNews.service'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'
import type { NewsletterDetail } from '../types'

export function NewsletterDetailPage() {
  const { newsletterId } = useParams<{ newsletterId: string }>()
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)

  useEffect(() => {
    if (!gaCode || !newsletterId) {
      return
    }
    let cancelled = false
    ;(async () => {
      const row = await getNewsletterDetail(gaCode, newsletterId, token)
      if (!cancelled) {
        setDetail(row)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gaCode, newsletterId, token])

  if (!gaCode) {
    return null
  }

  if (!detail) {
    return (
      <div className="insurer-news-empty" role="status">
        {newsletterId ? '소식지를 찾을 수 없습니다.' : '잘못된 경로입니다.'}
      </div>
    )
  }

  const imageRows = detail.attachments.filter((a) => a.kind === 'image').sort((a, b) => a.sortOrder - b.sortOrder)
  const galleryUrls = imageRows.length ? imageRows.map((a) => a.url) : detail.heroImageUrl ? [detail.heroImageUrl] : []

  return (
    <article className="insurer-news-detail-article">
      <header style={{ marginBottom: 16 }}>
        <p className="insurer-news-muted" style={{ margin: '0 0 4px', fontSize: 14 }}>
          {detail.insurerName}
        </p>
        <time dateTime={detail.publishedAt} style={{ fontSize: '0.95rem' }}>
          {formatInsurerNewsDateTime(detail.publishedAt)}
        </time>
      </header>
      <div className="insurer-news-detail-body" style={{ marginBottom: 8 }}>
        {detail.bodyText || '본문이 없습니다.'}
      </div>
      {galleryUrls.length > 0 ? <NewsletterImageGallery imageUrls={galleryUrls} altBase="소식지 이미지" /> : null}
      <NewsletterAttachmentList attachments={detail.attachments} />
    </article>
  )
}
