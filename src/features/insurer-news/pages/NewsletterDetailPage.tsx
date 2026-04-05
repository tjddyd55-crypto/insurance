import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterAttachmentList } from '../components/NewsletterAttachmentList'
import { NewsletterDetailHeader } from '../components/NewsletterDetailHeader'
import { NewsletterImageGallery } from '../components/NewsletterImageGallery'
import { getNewsletterDetail } from '../services/insurerNews.service'
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

  const imageUrls = detail.attachments.filter((a) => a.kind === 'image').sort((a, b) => a.sortOrder - b.sortOrder)
  const galleryUrls = imageUrls.length ? imageUrls.map((a) => a.url) : detail.heroImageUrl ? [detail.heroImageUrl] : []

  return (
    <article className="insurer-news-detail-article">
      <div className="insurer-news-detail-text">
        <NewsletterDetailHeader item={detail} />
        <div className="insurer-news-detail-body">{detail.bodyText || '본문이 없습니다.'}</div>
      </div>
      {galleryUrls.length > 0 ? (
        <NewsletterImageGallery imageUrls={galleryUrls} altBase={detail.title} />
      ) : null}
      <div className="insurer-news-detail-after">
        <NewsletterAttachmentList attachments={detail.attachments} />
      </div>
    </article>
  )
}
