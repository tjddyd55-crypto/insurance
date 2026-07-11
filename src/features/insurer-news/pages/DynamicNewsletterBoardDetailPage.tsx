import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NewsDetailViewerModal from '../../../components/news-detail-viewer/NewsDetailViewerModal'
import {
  NEWS_DETAIL_VIEWER_ZOOM_STEP,
  clampNewsDetailViewerZoom,
} from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import GaRequiredNotice from '../../../components/access/GaRequiredNotice'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import { ApiError } from '../../../lib/apiClient'
import {
  buildInsurerNewsDetailHeroDownloadUrl,
  InsurerNewsDetailViewerContent,
} from '../components/InsurerNewsDetailViewerContent'
import { getDynamicNewsletterBoardDetail } from '../services/insurerNews.service'
import { NewsletterViewerHeaderActions } from '../components/NewsletterViewerHeaderActions'
import type { NewsletterDetail } from '../types'

const ZOOM_STEP = NEWS_DETAIL_VIEWER_ZOOM_STEP

export function DynamicNewsletterBoardDetailPage() {
  const { boardSlug = '', newsletterId = '' } = useParams<{ boardSlug: string; newsletterId: string }>()
  const { user, token } = useAuth()
  const isPublicAccount = isPublicGeneralAccount(user)
  const navigate = useNavigate()
  const listPath = `/portal/boards/${encodeURIComponent(boardSlug)}`
  const [detail, setDetail] = useState<NewsletterDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessForbidden, setAccessForbidden] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let cancelled = false
    if (!token?.trim() || !boardSlug.trim() || !newsletterId.trim()) {
      setLoading(false)
      setDetail(null)
      setAccessForbidden(false)
      setError('소식지를 불러올 수 없습니다.')
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    setAccessForbidden(false)
    setError('')
    setZoom(1)
    void getDynamicNewsletterBoardDetail(boardSlug, newsletterId, token)
      .then((row) => {
        if (!cancelled) {
          setDetail(row)
          if (!row) {
            setError('소식지를 찾을 수 없거나 접근 권한이 없습니다.')
          }
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

  const viewerError =
    error ||
    (!loading && !detail && !accessForbidden ? '소식지를 찾을 수 없거나 접근 권한이 없습니다.' : null)

  const heroDownloadUrl = buildInsurerNewsDetailHeroDownloadUrl(detail, null)

  return (
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
      headerActions={<NewsletterViewerHeaderActions heroDownloadUrl={heroDownloadUrl} />}
    >
      {detail ? <InsurerNewsDetailViewerContent zoom={zoom} detail={detail} item={null} /> : null}
    </NewsDetailViewerModal>
  )
}
