import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import NewsDetailMobileZoomScroll from '../../../components/news-detail-viewer/NewsDetailMobileZoomScroll'
import GaRequiredNotice from '../../../components/access/GaRequiredNotice'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import { NewsletterAttachmentList } from '../components/NewsletterAttachmentList'
import { NewsletterImageGallery } from '../components/NewsletterImageGallery'
import { ApiError } from '../../../lib/apiClient'
import { getDynamicNewsletterBoardDetail } from '../services/insurerNews.service'
import type { NewsletterDetail } from '../types'
import { buildInsurerNewsGalleryUrls } from '../utils/buildInsurerNewsGalleryUrls'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'

export function DynamicNewsletterBoardDetailPage() {
  const { boardSlug = '', newsletterId = '' } = useParams<{ boardSlug: string; newsletterId: string }>()
  const { user, token } = useAuth()
  const isPublicAccount = isPublicGeneralAccount(user)
  const navigate = useNavigate()
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessForbidden, setAccessForbidden] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!token?.trim() || !boardSlug.trim() || !newsletterId.trim()) {
      setLoading(false)
      setDetail(null)
      setAccessForbidden(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    setAccessForbidden(false)
    setError('')
    void getDynamicNewsletterBoardDetail(boardSlug, newsletterId, token)
      .then((row) => {
        if (!cancelled) {
          setDetail(row)
        }
      })
      .catch((e) => {
        if (!cancelled && e instanceof ApiError) {
          if (e.status === 403) {
            setAccessForbidden(true)
            return
          }
          if (e.status === 404) {
            setError('게시판을 찾을 수 없습니다.')
            return
          }
          if (e.status >= 500 || e.message === 'DB_ERROR') {
            setError('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
            return
          }
          setError(e.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [boardSlug, newsletterId, token])

  if (isPublicAccount && !loading && accessForbidden) {
    return <GaRequiredNotice />
  }

  if (loading) {
    return (
      <main className="page page--with-back insurer-news-page">
        <div className="insurer-news-empty" role="status">
          불러오는 중...
        </div>
      </main>
    )
  }

  if (!detail) {
    return (
      <main className="page page--with-back insurer-news-page">
        <div className="insurer-news-empty" role="status">
          {error || '소식지를 찾을 수 없거나 접근 권한이 없습니다.'}
        </div>
      </main>
    )
  }

  const galleryUrls = buildInsurerNewsGalleryUrls({
    heroImageUrl: detail.heroImageUrl,
    heroImageObjectKey: detail.heroImageObjectKey,
    attachments: detail.attachments,
  })

  return (
    <main className="page page--with-back insurer-news-page">
      <article className="insurer-news-detail-article">
        <header style={{ marginBottom: 16 }}>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            onClick={() => navigate(`/portal/boards/${encodeURIComponent(boardSlug)}`)}
          >
            목록으로
          </FormButton>
          <p className="insurer-news-muted" style={{ margin: '12px 0 4px', fontSize: 14 }}>
            {detail.insurerName}
          </p>
          <time dateTime={detail.publishedAt} style={{ fontSize: '0.95rem' }}>
            {formatInsurerNewsDateTime(detail.publishedAt)}
          </time>
        </header>
        <NewsDetailMobileZoomScroll>
          <div className="insurer-news-detail-body news-text" style={{ marginBottom: 8 }}>
            {detail.bodyText || '본문이 없습니다.'}
          </div>
          {galleryUrls.length > 0 ? (
            <NewsletterImageGallery imageUrls={galleryUrls} altBase="소식지 이미지" resolveUrls />
          ) : null}
          <NewsletterAttachmentList attachments={detail.attachments} />
        </NewsDetailMobileZoomScroll>
      </article>
    </main>
  )
}
