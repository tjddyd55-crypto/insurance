import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import NewsDetailMobileZoomScroll from '../../../components/news-detail-viewer/NewsDetailMobileZoomScroll'
import RichTextContent from '../../../components/rich-text/RichTextContent'
import CustomerAppNewsAttachmentList from '../components/CustomerAppNewsAttachmentList'
import CustomerAppNewsImageGallery from '../components/CustomerAppNewsImageGallery'
import { getCustomerNewsDetail, markCustomerNewsRead, type CustomerAppNewsDetail } from '../api/customerAppApi'
import { buildCustomerNewsGalleryUrls } from '../model/buildCustomerNewsGalleryUrls'
import type { CustomerAppNewsAttachment } from '../api/customerAppApi'
import { useCustomerAppSession } from '../session/useCustomerAppSession'
import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'

function formatDateTime(iso: string | null): string {
  return formatKstDateTimeDisplay(iso, '—')
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

  const gallerySlideActions = useMemo(() => {
    const rows = [...(detail?.attachments ?? [])]
      .filter((row) => row.kind === 'image' || String(row.mimeType ?? '').toLowerCase().startsWith('image/'))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return rows.map((row: CustomerAppNewsAttachment) => ({
      openUrl: String(row.openUrl ?? row.url ?? '').trim(),
      downloadUrl: String(row.downloadUrl ?? row.openUrl ?? row.url ?? '').trim(),
      fileName: row.fileName,
    }))
  }, [detail?.attachments])

  const hasBodyContent = Boolean(detail?.content?.trim())

  return (
    <>
      <StatusMessage message={hasInvalidNewsId ? '잘못된 소식지 번호입니다.' : error} tone="error" />
      {!detail ? <div className="customer-app-news-page-hint">불러오는 중…</div> : null}
      {detail ? (
        <article className="insurer-news-detail-article customer-app-news-detail-article">
          <header className="insurer-news-detail-text customer-app-news-detail-header">
            <p className="insurer-news-muted customer-app-news-detail-kicker">고객 소식지</p>
            {detail.title && detail.title !== '전체소식지' ? (
              <h2 className="insurer-news-detail-header__title customer-app-news-detail-title">{detail.isPinned ? '[중요] ' : ''}{detail.title}</h2>
            ) : null}
            <time className="customer-app-news-detail-time" dateTime={detail.updatedAt ?? undefined}>
              {formatDateTime(detail.updatedAt)}
            </time>
          </header>
          <NewsDetailMobileZoomScroll>
            <div className="customer-app-news-detail__gallery">
              <CustomerAppNewsImageGallery
                imageUrls={buildCustomerNewsGalleryUrls({
                  heroImageUrl: detail.heroImageUrl,
                  attachments: detail.attachments ?? [],
                })}
                altBase="고객 소식지 이미지"
                slideActions={gallerySlideActions}
                appToken={session?.appToken ?? ''}
              />
            </div>
            {hasBodyContent ? (
              <RichTextContent
                value={detail.content || ''}
                className="insurer-news-detail-body insurer-news-detail-text rich-text-content news-text"
                emptyText=""
              />
            ) : null}
            <div className="insurer-news-detail-after">
              {session ? (
                <CustomerAppNewsAttachmentList attachments={detail.attachments ?? []} appToken={session.appToken} />
              ) : null}
            </div>
          </NewsDetailMobileZoomScroll>
        </article>
      ) : null}
    </>
  )
}
