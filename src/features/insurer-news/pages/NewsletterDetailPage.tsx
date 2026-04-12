import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterAttachmentList } from '../components/NewsletterAttachmentList'
import { NewsletterImageGallery } from '../components/NewsletterImageGallery'
import { deleteManagerNewsletter, getNewsletterDetail } from '../services/insurerNews.service'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'
import type { NewsChannel, NewsletterDetail } from '../types'

export function NewsletterDetailPage({
  channel = 'INSURER',
  listPath = '/portal/newsletters/recent',
}: {
  channel?: NewsChannel
  listPath?: string
}) {
  const { newsletterId } = useParams<{ newsletterId: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const canDelete = user?.role === 'GA_ADMIN' || user?.role === 'GA_STAFF'

  useEffect(() => {
    if (!gaCode || !newsletterId) {
      return
    }
    let cancelled = false
    ;(async () => {
      const row = await getNewsletterDetail(gaCode, newsletterId, token, { channel })
      if (!cancelled) {
        setDetail(row)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [channel, gaCode, newsletterId, token])

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
        {canDelete ? (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="button button--secondary"
              disabled={deleteBusy || !token?.trim()}
              onClick={() => {
                if (!newsletterId || !token?.trim() || deleteBusy) {
                  return
                }
                if (!window.confirm('이 소식지를 삭제하시겠습니까?')) {
                  return
                }
                setDeleteError('')
                setDeleteBusy(true)
                void (async () => {
                  try {
                    await deleteManagerNewsletter(token, newsletterId, { channel })
                    navigate(listPath, { replace: true })
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : '소식지 삭제에 실패했습니다.')
                    setDeleteBusy(false)
                  }
                })()
              }}
            >
              {deleteBusy ? '삭제 중…' : '삭제'}
            </button>
          </div>
        ) : null}
        {deleteError ? (
          <p className="status status--error" style={{ marginTop: 8 }}>
            {deleteError}
          </p>
        ) : null}
      </header>
      <div className="insurer-news-detail-body" style={{ marginBottom: 8 }}>
        {detail.bodyText || '본문이 없습니다.'}
      </div>
      {galleryUrls.length > 0 ? <NewsletterImageGallery imageUrls={galleryUrls} altBase="소식지 이미지" /> : null}
      <NewsletterAttachmentList attachments={detail.attachments} />
    </article>
  )
}
