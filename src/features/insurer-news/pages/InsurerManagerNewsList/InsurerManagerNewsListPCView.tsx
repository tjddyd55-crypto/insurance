import { useRef, useState } from 'react'
import NewsDetailViewerModal from '../../../../components/news-detail-viewer/NewsDetailViewerModal'
import NewsDetailZoomContent from '../../../../components/news-detail-viewer/NewsDetailZoomContent'
import { FormInput } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import { NewsletterList } from '../../components/NewsletterList'
import {
  getNewsletterDetail,
  getNewsletterDetailForInsurerManager,
} from '../../services/insurerNews.service'
import type { NewsletterDetail, NewsletterItem } from '../../types'
import type { InsurerManagerNewsListViewProps } from './insurerManagerNewsListViewProps'
import { buildInsurerNewsGalleryUrls } from '../../utils/buildInsurerNewsGalleryUrls'
import { resolveInsurerNewsListCardImageUrl } from '../../utils/resolveInsurerNewsImageUrl'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.2

/**
 * [PC 전용 View] 원수사 소식지 목록 — 데스크톱.
 *
 * 책임: 목록 마크업 + 아이템 클릭 시 "같은 페이지 인라인 모달" 로 상세 표시.
 *   - PC 는 화면 폭이 충분하므로 라우트 이동 대신 인라인 모달이 UX 에 유리.
 *   - 상세 조회 state (selectedItem, selectedDetail, loading, error, zoom) 는
 *     여기서만 쓰이므로 container 가 아닌 View 내부에 둔다.
 *   - 상세 API 호출에 필요한 `gaCode` / `companyId` / `token` 는 `useAuth` 로 직접
 *     조달 (props drilling 으로 내려받지 않음).
 *   - `channel` / `fetchScope` 만 container 가 View props 로 주입한다
 *     (여러 호출처마다 다른 값).
 *
 * 요청 경쟁 대응:
 *   사용자가 아이템을 연속 클릭해 여러 번 상세를 여는 경우, 늦게 도착한 응답이
 *   이미 선택이 바뀐 상태를 덮어쓰지 않도록 `openRequestIdRef` 로 응답 유효성을
 *   판별한다 (기존 container 로직을 그대로 이전).
 */
export default function InsurerManagerNewsListPCView({
  items,
  error,
  title,
  emptyMessage,
  channel,
  fetchScope,
  searchQuery,
  onSearchQueryChange,
  noSearchResults,
}: InsurerManagerNewsListViewProps) {
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId

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
  }

  const openDetailModal = (id: string) => {
    const picked = items.find((item) => item.id === id) ?? null
    if (!picked) {
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
        const detail =
          fetchScope === 'ga'
            ? await getNewsletterDetail(gaCode, id, token, { channel })
            : await getNewsletterDetailForInsurerManager(token ?? '', gaCode, companyId ?? 0, id, { channel })
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

  const heroDownloadUrl = selectedDetail
    ? buildInsurerNewsGalleryUrls({
        heroImageUrl: selectedDetail.heroImageUrl,
        heroImageObjectKey: selectedDetail.heroImageObjectKey,
        attachments: selectedDetail.attachments,
      })[0] ?? ''
    : selectedItem
      ? resolveInsurerNewsListCardImageUrl(selectedItem)
      : ''

  const modalGalleryUrls = selectedDetail
    ? buildInsurerNewsGalleryUrls({
        heroImageUrl: selectedDetail.heroImageUrl,
        heroImageObjectKey: selectedDetail.heroImageObjectKey,
        attachments: selectedDetail.attachments,
      })
    : selectedItem
      ? [resolveInsurerNewsListCardImageUrl(selectedItem)].filter(Boolean)
      : []

  return (
    <main className="page page--with-back insurer-news-page insurer-news-page--pc user-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>{title}</h1>
        </div>
      </header>
      <div className="insurer-news-filters insurer-news-list-searchbar">
        <label className="insurer-news-search insurer-news-searchbar">
          <span className="sr-only">소식지 검색</span>
          <FormInput
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="제목, 내용, 회사명, 날짜 검색"
            aria-label="소식지 검색"
          />
        </label>
      </div>
      {error ? <div className="insurer-news-empty">{error}</div> : null}
      <NewsletterList
        items={items}
        emptyMessage={emptyMessage}
        variant="pc"
        onOpenItem={openDetailModal}
        noSearchResults={noSearchResults}
      />
      <NewsDetailViewerModal
        open={selectedItem != null}
        onClose={closeDetailModal}
        zoom={zoom}
        onZoomIn={() => setZoom((v) => Math.min(v + ZOOM_STEP, ZOOM_MAX))}
        onZoomOut={() => setZoom((v) => Math.max(v - ZOOM_STEP, ZOOM_MIN))}
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
        <NewsDetailZoomContent zoom={zoom}>
          {(selectedDetail?.bodyText?.trim() || selectedItem?.summary?.trim()) ? (
            <div className="news-text">{selectedDetail?.bodyText?.trim() || selectedItem?.summary}</div>
          ) : null}
          {modalGalleryUrls.map((url) => (
            <img key={url} src={url} alt="" />
          ))}
        </NewsDetailZoomContent>
      </NewsDetailViewerModal>
    </main>
  )
}
