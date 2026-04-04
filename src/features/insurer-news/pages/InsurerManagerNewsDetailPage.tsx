import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterAttachmentList } from '../components/NewsletterAttachmentList'
import { NewsletterDetailHeader } from '../components/NewsletterDetailHeader'
import { NewsletterImageGallery } from '../components/NewsletterImageGallery'
import { getNewsletterDetailForInsurerManager } from '../services/insurerNews.service'
import type { NewsletterDetail } from '../types'

export function InsurerManagerNewsDetailPage() {
  const { newsletterId } = useParams<{ newsletterId: string }>()
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token?.trim() || !gaCode || companyId == null || !newsletterId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const row = await getNewsletterDetailForInsurerManager(token, gaCode, companyId, newsletterId)
      if (!cancelled) {
        setDetail(row)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, gaCode, companyId, newsletterId])

  if (!gaCode || companyId == null) {
    return null
  }

  if (loading) {
    return (
      <main className="page page--with-back insurer-news-page">
        <PageBackButton />
        <div className="insurer-news-empty" role="status">
          불러오는 중…
        </div>
      </main>
    )
  }

  if (!detail) {
    return (
      <main className="page page--with-back insurer-news-page">
        <PageBackButton />
        <div className="insurer-news-empty" role="status">
          {newsletterId ? '소식지를 찾을 수 없거나 접근 권한이 없습니다.' : '잘못된 경로입니다.'}
        </div>
      </main>
    )
  }

  const imageRows = detail.attachments.filter((a) => a.kind === 'image').sort((a, b) => a.sortOrder - b.sortOrder)
  const galleryUrls = imageRows.length
    ? imageRows.map((a) => a.url)
    : detail.heroImageUrl
      ? [detail.heroImageUrl]
      : []

  return (
    <main className="page page--with-back insurer-news-page">
      <PageBackButton />
      <article>
        <NewsletterDetailHeader item={detail} />
        {galleryUrls.length ? <NewsletterImageGallery imageUrls={galleryUrls} altBase={detail.title} /> : null}
        <div className="insurer-news-body">{detail.bodyText || '본문이 없습니다.'}</div>
        <NewsletterAttachmentList attachments={detail.attachments} />
      </article>
    </main>
  )
}
