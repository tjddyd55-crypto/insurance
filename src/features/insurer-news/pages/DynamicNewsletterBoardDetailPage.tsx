import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import NewsDetailViewerModal from '../../../components/news-detail-viewer/NewsDetailViewerModal'
import {
  NEWS_DETAIL_VIEWER_ZOOM_STEP,
  clampNewsDetailViewerZoom,
} from '../../../components/news-detail-viewer/newsDetailViewerZoom'
import GaRestrictedFeatureNotice from '../../../components/access/GaRestrictedFeatureNotice'
import { useAuth } from '../../auth/AuthProvider'
import { isPublicGeneralAccount } from '../../auth/generalGa'
import { ApiError } from '../../../lib/apiClient'
import {
  buildInsurerNewsDetailHeroDownloadUrl,
  InsurerNewsDetailViewerContent,
} from '../components/InsurerNewsDetailViewerContent'
import { getDynamicNewsletterBoardDetail } from '../services/insurerNews.service'
import { NewsletterViewerHeaderActions } from '../components/NewsletterViewerHeaderActions'

const ZOOM_STEP = NEWS_DETAIL_VIEWER_ZOOM_STEP

function resolveDetailError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return '게시판을 찾을 수 없습니다.'
    }
    if (error.status >= 500 || error.message === 'DB_ERROR') {
      return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    }
    return error.message
  }
  return '소식지를 찾을 수 없거나 접근 권한이 없습니다.'
}

export function DynamicNewsletterBoardDetailPage() {
  const { boardSlug = '', newsletterId = '' } = useParams<{ boardSlug: string; newsletterId: string }>()
  const { user, token } = useAuth()
  const isPublicAccount = isPublicGeneralAccount(user)
  const navigate = useNavigate()
  const listPath = `/portal/boards/${encodeURIComponent(boardSlug)}`
  const [zoom, setZoom] = useState(1)
  const canLoad = Boolean(token?.trim() && boardSlug.trim() && newsletterId.trim())

  const query = useQuery({
    queryKey: ['dynamic-newsletter-board-detail', boardSlug, newsletterId, token],
    queryFn: async () => {
      const row = await getDynamicNewsletterBoardDetail(boardSlug, newsletterId, token!)
      if (!row) {
        throw new ApiError('소식지를 찾을 수 없거나 접근 권한이 없습니다.', 404)
      }
      return row
    },
    enabled: canLoad,
    retry: false,
  })

  const accessForbidden = query.error instanceof ApiError && query.error.status === 403
  const viewerError = useMemo(() => {
    if (!canLoad) {
      return '소식지를 불러올 수 없습니다.'
    }
    if (accessForbidden) {
      return null
    }
    if (query.isError) {
      return resolveDetailError(query.error)
    }
    return null
  }, [accessForbidden, canLoad, query.error, query.isError])

  if (isPublicAccount && !query.isLoading && accessForbidden) {
    return <GaRestrictedFeatureNotice feature="loss-adjuster-board" />
  }

  const detail = query.data ?? null
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
      loading={query.isLoading}
      error={viewerError}
      ariaLabel={detail?.title ? `소식지 · ${detail.title}` : '소식지 상세'}
      headerActions={<NewsletterViewerHeaderActions heroDownloadUrl={heroDownloadUrl} />}
    >
      {detail ? <InsurerNewsDetailViewerContent zoom={zoom} detail={detail} item={null} /> : null}
    </NewsDetailViewerModal>
  )
}
