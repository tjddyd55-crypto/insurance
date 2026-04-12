import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterAttachmentList } from '../components/NewsletterAttachmentList'
import { NewsletterImageGallery } from '../components/NewsletterImageGallery'
import { deleteManagerNewsletter, getNewsletterDetailForInsurerManager } from '../services/insurerNews.service'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'
import type { NewsChannel, NewsletterDetail } from '../types'

export function InsurerManagerNewsDetailPage({
  channel = 'INSURER',
  listPath = '/insurer/news',
}: {
  channel?: NewsChannel
  listPath?: string
}) {
  const { newsletterId } = useParams<{ newsletterId: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId
  const requiresCompanyScope = channel !== 'LOSS_ADJUSTER'
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!token?.trim() || !gaCode || (requiresCompanyScope && companyId == null) || !newsletterId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const row = await getNewsletterDetailForInsurerManager(token, gaCode, companyId ?? 0, newsletterId, { channel })
      if (!cancelled) {
        setDetail(row)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [channel, token, gaCode, companyId, newsletterId, requiresCompanyScope])

  if (!gaCode || (requiresCompanyScope && companyId == null)) {
    return null
  }

  if (loading) {
    return (
      <main className="page page--with-back insurer-news-page">
        <div className="insurer-news-empty" role="status">
          불러오는 중…
        </div>
      </main>
    )
  }

  if (!detail) {
    return (
      <main className="page page--with-back insurer-news-page">
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
  const role = user?.role ?? ''
  const isGaDeleteRole = role === 'GA_ADMIN' || role === 'GA_STAFF'
  const isManagerRole = role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER'
  const isAuthor = Boolean(detail.publisherId && String(detail.publisherId) === String(user?.id ?? ''))
  const canDelete = isGaDeleteRole || (isManagerRole && isAuthor)

  return (
    <main className="page page--with-back insurer-news-page">
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
                disabled={deleteBusy || !token?.trim() || !newsletterId}
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
    </main>
  )
}
