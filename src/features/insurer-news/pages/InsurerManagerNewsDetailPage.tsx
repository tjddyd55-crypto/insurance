import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirmDialog } from '../../../components/dialog'
import NewsDetailViewerModal from '../../../components/news-detail-viewer/NewsDetailViewerModal'
import {
  NEWS_DETAIL_VIEWER_ZOOM_STEP,
  clampNewsDetailViewerZoom,
} from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import GaRequiredNotice from '../../../components/access/GaRequiredNotice'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import {
  buildInsurerNewsDetailHeroDownloadUrl,
  InsurerNewsDetailViewerContent,
} from '../components/InsurerNewsDetailViewerContent'
import { NewsletterViewerHeaderActions } from '../components/NewsletterViewerHeaderActions'
import { deleteManagerNewsletter, getNewsletterDetail, getNewsletterDetailForInsurerManager } from '../services/insurerNews.service'
import { canDeleteNewsletter } from '../utils/newsletterDeletePermission'
import type { NewsChannel, NewsletterDetail } from '../types'

const ZOOM_STEP = NEWS_DETAIL_VIEWER_ZOOM_STEP

export function InsurerManagerNewsDetailPage({
  channel = 'INSURER',
  listPath = '/insurer/news',
  detailScope = 'manager',
}: {
  channel?: NewsChannel
  listPath?: string
  detailScope?: 'manager' | 'ga'
}) {
  const { newsletterId } = useParams<{ newsletterId: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId
  const isPublicAccount = isPublicGeneralAccount(user)
  const requiresCompanyScope = detailScope === 'manager' && channel !== 'LOSS_ADJUSTER'
  const canFetch =
    !isPublicAccount &&
    Boolean(token?.trim() && gaCode && (!requiresCompanyScope || companyId != null) && newsletterId)
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const { confirm, confirmDialog } = useConfirmDialog()
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!canFetch) {
      setLoading(false)
      setDetail(null)
      setFetchError(newsletterId ? '소식지를 불러올 수 없습니다.' : '잘못된 경로입니다.')
      return
    }
    let cancelled = false
    setLoading(true)
    setFetchError('')
    setZoom(1)
    void (async () => {
      try {
        const row =
          detailScope === 'ga'
            ? await getNewsletterDetail(gaCode, newsletterId, token, { channel })
            : await getNewsletterDetailForInsurerManager(token, gaCode, companyId ?? 0, newsletterId, { channel })
        if (!cancelled) {
          setDetail(row)
          if (!row) {
            setFetchError('소식지를 찾을 수 없거나 접근 권한이 없습니다.')
          }
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : '소식지를 불러올 수 없습니다.')
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
  }, [canFetch, detailScope, channel, token, gaCode, companyId, newsletterId])

  if (isPublicAccount) {
    return <GaRequiredNotice />
  }

  if (!gaCode || (requiresCompanyScope && companyId == null)) {
    return null
  }

  const canDelete = detail ? canDeleteNewsletter(detail, user) : false
  const heroDownloadUrl = buildInsurerNewsDetailHeroDownloadUrl(detail, null)
  const viewerError = deleteError || fetchError || null

  const handleDelete = () => {
    if (!newsletterId || !token?.trim() || deleteBusy) {
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
        await deleteManagerNewsletter(token, newsletterId, { channel })
        navigate(listPath, { replace: true })
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : '소식지 삭제에 실패했습니다.')
        setDeleteBusy(false)
      }
    })()
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
        error={viewerError}
        ariaLabel={detail?.title ? `소식지 · ${detail.title}` : '소식지 상세'}
        headerActions={
          <NewsletterViewerHeaderActions
            heroDownloadUrl={heroDownloadUrl}
            canDelete={canDelete}
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
