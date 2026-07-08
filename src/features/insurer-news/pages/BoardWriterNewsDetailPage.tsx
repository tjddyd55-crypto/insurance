import { FormButton } from '../../../components/form'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirmDialog } from '../../../components/dialog'
import NewsDetailMobileZoomScroll from '../../../components/news-detail-viewer/NewsDetailMobileZoomScroll'
import { InsurerNewsForm } from '../components/InsurerNewsForm'
import { NewsletterAttachmentList } from '../components/NewsletterAttachmentList'
import { NewsletterImageGallery } from '../components/NewsletterImageGallery'
import {
  deleteBoardWriterNewsletter,
  fetchPublicBoardWriterMe,
  getBoardWriterNewsletter,
  getPublicBoardWriterToken,
  clearPublicBoardWriterSession,
  updateBoardWriterNewsletter,
  uploadBoardWriterAttachments,
} from '../services/publicBoardWriter.service'
import { buildInsurerNewsGalleryUrls } from '../utils/buildInsurerNewsGalleryUrls'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'
import { normalizeInsurerNewsText } from '../utils/insurerNewsText'
import type { NewsletterDetail } from '../types'

export function BoardWriterNewsDetailPage() {
  const { boardSlug = '', newsletterId = '' } = useParams<{ boardSlug: string; newsletterId: string }>()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [writerId, setWriterId] = useState('')
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const [boardLabel, setBoardLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const { confirm, confirmDialog } = useConfirmDialog()

  const listPath = `/board-writer/boards/${encodeURIComponent(boardSlug)}/news`

  useEffect(() => {
    const writerToken = getPublicBoardWriterToken()
    if (!writerToken?.trim() || !boardSlug.trim() || !newsletterId.trim()) {
      navigate('/board-writer/login', { replace: true })
      return
    }
    setToken(writerToken)
    let cancelled = false
    void (async () => {
      try {
        const me = await fetchPublicBoardWriterMe(writerToken)
        const row = await getBoardWriterNewsletter(writerToken, boardSlug, newsletterId)
        if (cancelled) {
          return
        }
        setWriterId(me.id)
        setDetail(row)
        setBoardLabel(row.insurerName || '소식지')
      } catch {
        if (!cancelled) {
          clearPublicBoardWriterSession()
          navigate('/board-writer/login', { replace: true })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [boardSlug, newsletterId, navigate])

  if (!token || loading) {
    return (
      <main className="page page--with-back insurer-news-page user-page">
        <div className="insurer-news-empty">불러오는 중…</div>
      </main>
    )
  }

  if (!detail) {
    return (
      <main className="page page--with-back insurer-news-page user-page">
        <div className="insurer-news-empty">소식지를 찾을 수 없거나 접근 권한이 없습니다.</div>
      </main>
    )
  }

  const isAuthor = Boolean(detail.publisherId && String(detail.publisherId) === String(writerId))
  const bodyText = normalizeInsurerNewsText(detail.bodyText)
  const galleryUrls = buildInsurerNewsGalleryUrls({
    heroImageUrl: detail.heroImageUrl,
    heroImageObjectKey: detail.heroImageObjectKey,
    attachments: detail.attachments,
  })

  const handleDelete = () => {
    if (!token || deleteBusy) {
      return
    }
    void (async () => {
      const confirmed = await confirm({
        title: '소식지 삭제',
        message: '이 소식지를 삭제하시겠습니까? 삭제하면 첨부 파일도 함께 영구 삭제됩니다.',
        tone: 'danger',
      })
      if (!confirmed) {
        return
      }
      setDeleteError('')
      setDeleteBusy(true)
      try {
        await deleteBoardWriterNewsletter(token, boardSlug, newsletterId)
        navigate(listPath, { replace: true })
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : '소식지 삭제에 실패했습니다.')
        setDeleteBusy(false)
      }
    })()
  }

  if (editing && isAuthor) {
    return (
      <main className="page page--with-back insurer-news-page user-page">
        <header className="page-header" style={{ marginBottom: 16 }}>
          <h1 style={{ marginBottom: 8 }}>{boardLabel} 수정</h1>
        </header>
        <InsurerNewsForm
          mode="edit"
          initial={detail}
          newsletterId={newsletterId}
          context={{
            gaCode: detail.gaCode,
            insurerCode: detail.insurerCode,
            insurerName: detail.insurerName,
            insurerSlug: detail.insurerSlug,
          }}
          authToken={token}
          uploadAttachments={(authToken, drafts) => uploadBoardWriterAttachments(authToken, boardSlug, drafts)}
          onCancel={() => setEditing(false)}
          onSubmit={async (draft) => {
            const updated = await updateBoardWriterNewsletter(token, boardSlug, newsletterId, draft)
            setDetail(updated)
            setEditing(false)
          }}
        />
      </main>
    )
  }

  return (
    <main className="page page--with-back insurer-news-page user-page">
      <article className="insurer-news-detail-article">
        <header style={{ marginBottom: 16 }}>
          <p className="insurer-news-muted" style={{ margin: '0 0 4px', fontSize: 14 }}>
            {detail.insurerName}
          </p>
          <time dateTime={detail.publishedAt} style={{ fontSize: '0.95rem' }}>
            {formatInsurerNewsDateTime(detail.publishedAt)}
          </time>
          {isAuthor ? (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <FormButton htmlType="button" variant="primary" onClick={() => setEditing(true)}>
                수정
              </FormButton>
              <FormButton htmlType="button" variant="secondary" disabled={deleteBusy} onClick={handleDelete}>
                {deleteBusy ? '삭제 중…' : '삭제'}
              </FormButton>
            </div>
          ) : null}
          {deleteError ? (
            <p className="status status--error" style={{ marginTop: 8 }}>
              {deleteError}
            </p>
          ) : null}
        </header>
        <NewsDetailMobileZoomScroll>
          {bodyText ? (
            <div className="insurer-news-detail-body news-text" style={{ marginBottom: 8 }}>
              {bodyText}
            </div>
          ) : null}
          {galleryUrls.length > 0 ? (
            <NewsletterImageGallery imageUrls={galleryUrls} altBase="소식지 이미지" resolveUrls />
          ) : null}
          <NewsletterAttachmentList attachments={detail.attachments} />
        </NewsDetailMobileZoomScroll>
      </article>
      {confirmDialog}
    </main>
  )
}
