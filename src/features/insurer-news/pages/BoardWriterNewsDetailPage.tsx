import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirmDialog } from '../../../components/dialog'
import NewsDetailViewerModal from '../../../components/news-detail-viewer/NewsDetailViewerModal'
import {
  NEWS_DETAIL_VIEWER_ZOOM_STEP,
  clampNewsDetailViewerZoom,
} from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import { InsurerNewsForm } from '../components/InsurerNewsForm'
import {
  buildInsurerNewsDetailHeroDownloadUrl,
  InsurerNewsDetailViewerContent,
} from '../components/InsurerNewsDetailViewerContent'
import { NewsletterViewerHeaderActions } from '../components/NewsletterViewerHeaderActions'
import {
  deleteBoardWriterNewsletter,
  fetchPublicBoardWriterMe,
  getBoardWriterNewsletter,
  getPublicBoardWriterToken,
  clearPublicBoardWriterSession,
  updateBoardWriterNewsletter,
  uploadBoardWriterAttachments,
} from '../services/publicBoardWriter.service'
import type { NewsletterDetail } from '../types'

const ZOOM_STEP = NEWS_DETAIL_VIEWER_ZOOM_STEP

export function BoardWriterNewsDetailPage() {
  const { boardSlug = '', newsletterId = '' } = useParams<{ boardSlug: string; newsletterId: string }>()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [writerId, setWriterId] = useState('')
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const [boardLabel, setBoardLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [zoom, setZoom] = useState(1)
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
    setLoading(true)
    setFetchError('')
    setZoom(1)
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

  const isAuthor = Boolean(detail?.publisherId && String(detail.publisherId) === String(writerId))
  const heroDownloadUrl = buildInsurerNewsDetailHeroDownloadUrl(detail, null)
  const viewerError = deleteError || fetchError || null

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

  if (editing && isAuthor && detail && token) {
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
          enableLinkPreview
          linkPreviewEndpoint="/api/board-writer/link-preview"
          enableAutoLinking
          enablePhoneLinks
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

  if (!token) {
    return null
  }

  return (
    <>
      <NewsDetailViewerModal
        open
        onClose={() => navigate(listPath)}
        zoom={zoom}
        onZoomChange={(next) => setZoom(clampNewsDetailViewerZoom(next))}
        onZoomIn={() => setZoom((value) => clampNewsDetailViewerZoom(value + ZOOM_STEP))}
        onZoomOut={() => setZoom((value) => clampNewsDetailViewerZoom(value - ZOOM_STEP))}
        zoomControlVariant="symbols"
        closeLabel="✕"
        loading={loading}
        error={viewerError || (!loading && !detail ? '소식지를 찾을 수 없거나 접근 권한이 없습니다.' : null)}
        ariaLabel={detail?.title ? `소식지 · ${detail.title}` : '소식지 상세'}
        headerActions={
          <NewsletterViewerHeaderActions
            heroDownloadUrl={heroDownloadUrl}
            canEdit={isAuthor}
            onEdit={() => setEditing(true)}
            canDelete={isAuthor}
            onDelete={handleDelete}
            deleteBusy={deleteBusy}
          />
        }
      >
        {detail ? <InsurerNewsDetailViewerContent zoom={zoom} detail={detail} item={null} /> : null}
      </NewsDetailViewerModal>
      {confirmDialog}
    </>
  )
}
