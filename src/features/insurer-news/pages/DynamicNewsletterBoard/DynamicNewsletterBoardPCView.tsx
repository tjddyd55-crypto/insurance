import { useRef, useState } from 'react'
import NewsDetailViewerModal from '../../../../components/news-detail-viewer/NewsDetailViewerModal'
import {
  NEWS_DETAIL_VIEWER_ZOOM_STEP,
  clampNewsDetailViewerZoom,
} from '../../../../components/news-detail-viewer/newsDetailViewerZoom'
import { FormInput } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import {
  buildInsurerNewsDetailHeroDownloadUrl,
  InsurerNewsDetailViewerContent,
} from '../../components/InsurerNewsDetailViewerContent'
import { NewsletterList } from '../../components/NewsletterList'
import { getDynamicNewsletterBoardDetail } from '../../services/insurerNews.service'
import type { NewsletterDetail, NewsletterItem } from '../../types'
import type { DynamicNewsletterBoardViewProps } from './dynamicNewsletterBoardViewProps'

const ZOOM_STEP = NEWS_DETAIL_VIEWER_ZOOM_STEP

export default function DynamicNewsletterBoardPCView({
  boardSlug,
  board,
  items,
  error,
  loading,
  searchQuery,
  onSearchQueryChange,
  noSearchResults,
}: DynamicNewsletterBoardViewProps) {
  const { token } = useAuth()
  const title = board?.label ?? '소식지'

  const [selectedItem, setSelectedItem] = useState<NewsletterItem | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<NewsletterDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [zoom, setZoom] = useState(1)
  const openRequestIdRef = useRef(0)

  const closeDetailModal = () => {
    openRequestIdRef.current += 1
    setSelectedItem(null)
    setSelectedDetail(null)
    setDetailLoading(false)
    setDetailError('')
    setZoom(1)
  }

  const openDetailModal = (id: string) => {
    const picked = items.find((item) => item.id === id) ?? null
    if (!picked || !token?.trim() || !boardSlug.trim()) {
      return
    }
    setSelectedItem(picked)
    setSelectedDetail(null)
    setDetailLoading(true)
    setDetailError('')
    setZoom(1)
    const requestId = openRequestIdRef.current + 1
    openRequestIdRef.current = requestId

    void (async () => {
      try {
        const detail = await getDynamicNewsletterBoardDetail(boardSlug, id, token)
        if (openRequestIdRef.current !== requestId) {
          return
        }
        setSelectedDetail(detail)
        if (!detail) {
          setDetailError('소식지 상세를 불러오지 못했습니다.')
        }
      } catch (e) {
        if (openRequestIdRef.current !== requestId) {
          return
        }
        setDetailError(e instanceof Error ? e.message : '소식지 상세를 불러오지 못했습니다.')
      } finally {
        if (openRequestIdRef.current === requestId) {
          setDetailLoading(false)
        }
      }
    })()
  }

  const heroDownloadUrl = buildInsurerNewsDetailHeroDownloadUrl(selectedDetail, selectedItem)

  const scopeLabel = board?.isPublic ? '공용 게시판' : 'GA 전용 게시판'

  return (
    <main className="page page--with-back insurer-news-page insurer-news-page--pc user-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>{title}</h1>
          {board ? <span className="insurer-news-page__board-scope">{scopeLabel}</span> : null}
        </div>
      </header>
      <div className="insurer-news-filters insurer-news-list-searchbar">
        <label className="insurer-news-search insurer-news-searchbar">
          <span className="sr-only">소식지 검색</span>
          <FormInput
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="제목, 내용, 회사명, 날짜 검색"
            aria-label="소식지 검색"
          />
        </label>
      </div>
      {loading ? <div className="insurer-news-empty">불러오는 중...</div> : null}
      {error ? <div className="insurer-news-empty">{error}</div> : null}
      {!loading ? (
        <NewsletterList
          items={items}
          emptyMessage="등록된 소식지가 없습니다."
          variant="pc"
          onOpenItem={openDetailModal}
          noSearchResults={noSearchResults}
        />
      ) : null}
      <NewsDetailViewerModal
        open={selectedItem != null}
        onClose={closeDetailModal}
        zoom={zoom}
        onZoomChange={(next) => setZoom(clampNewsDetailViewerZoom(next))}
        onZoomIn={() => setZoom((value) => clampNewsDetailViewerZoom(value + ZOOM_STEP))}
        onZoomOut={() => setZoom((value) => clampNewsDetailViewerZoom(value - ZOOM_STEP))}
        zoomControlVariant="symbols"
        closeLabel="✕"
        loading={detailLoading}
        error={detailError || null}
        ariaLabel={selectedItem?.title ? `소식지 · ${selectedItem.title}` : '소식지 상세'}
        headerActions={
          heroDownloadUrl ? (
            <a
              href={heroDownloadUrl}
              download
              className="button filter-button download-btn"
              target="_blank"
              rel="noreferrer"
            >
              다운로드
            </a>
          ) : null
        }
      >
        <InsurerNewsDetailViewerContent zoom={zoom} detail={selectedDetail} item={selectedItem} />
      </NewsDetailViewerModal>
    </main>
  )
}
