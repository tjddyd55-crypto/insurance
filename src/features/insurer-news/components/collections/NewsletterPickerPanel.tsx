import './newsletterCollections.css'
import '../../insurer-news.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import NewsDetailViewerModal from '../../../../components/news-detail-viewer/NewsDetailViewerModal'
import {
  NEWS_DETAIL_VIEWER_ZOOM_STEP,
  clampNewsDetailViewerZoom,
} from '../../../../components/news-detail-viewer/newsDetailViewerZoom'
import { FormButton, FormInput, FormSelect } from '../../../../components/form'
import { formatTimestampSearchHaystack } from '../../../../utils/displayDateTime'
import { useAuth } from '../../../auth/AuthProvider'
import type { NewsletterDetail, NewsletterItem, NewsletterSourceKind } from '../../types'
import type { NewsletterCollections } from '../../services/newsletterCollections.service'
import {
  NEWSLETTER_SOURCE_KIND_LABEL,
  loadNewsletterSourceDetail,
} from '../../services/newsletterCollections.service'
import { useNewsletterPickerSources } from './useNewsletterPickerSources'
import {
  InsurerNewsDetailViewerContent,
} from '../InsurerNewsDetailViewerContent'
import { formatInsurerNewsDateLabel } from '../../utils/formatInsurerNewsDate'
import {
  resolveInsurerNewsListCardImageUrl,
} from '../../utils/resolveInsurerNewsImageUrl'
import { normalizeInsurerNewsText } from '../../utils/insurerNewsText'
import { newsletterItemLabel } from './newsletterItemLabel'

const ZOOM_STEP = NEWS_DETAIL_VIEWER_ZOOM_STEP

function PickerCardImage({ imageUrl, headline }: { imageUrl: string | null; headline: string }) {
  const [failed, setFailed] = useState(false)
  const hasImage = Boolean(imageUrl) && !failed
  const hasHeadline = headline.length > 0

  return (
    <div className="news-card__media newsletter-picker-card__media">
      {hasImage ? (
        <img
          src={imageUrl!}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : null}
      {(!hasImage && hasHeadline) ? (
        <div className="news-card__placeholder news-card__placeholder--content" aria-hidden>
          <span className="news-card__placeholder-label news-card__placeholder-label--headline">
            {headline}
          </span>
        </div>
      ) : null}
      {!hasImage && !hasHeadline ? (
        <div className="news-card__placeholder news-card__placeholder--content" aria-hidden>
          <span className="news-card__placeholder-label">이미지 없음</span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 소식지 다중 선택 패널 — 종류(전체/원수사/GA/공용) + 원수사 필터(원수사 종류에서만) + 검색
 * + (전체/즐겨찾기/내 폴더) 출처. 목록은 서버 공통 소스(picker-sources)에서 읽는다 (t299).
 * 폴더의 [소식지 추가], 바인더의 [소식지] 출처 탭에서 공용으로 쓴다.
 * 원수사 목록과 같은 썸네일 카드 그리드 + 체크박스 + 미리보기.
 */
export function NewsletterPickerPanel({
  items: itemsOverride,
  collections,
  selectedIds,
  onSelectedIdsChange,
  disabledIds,
  disabledLabel = '추가됨',
  showSourceFilter = true,
  hideDisabledByDefault = false,
}: {
  /** 생략하면 서버 공통 소스(원수사·GA·공용 열람 가능분)를 읽는다. */
  items?: NewsletterItem[]
  collections: NewsletterCollections
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  disabledIds?: Set<string>
  disabledLabel?: string
  showSourceFilter?: boolean
  /** true 이면 이미 담긴(disabled) 항목을 기본 숨기고, 토글로 전체 표시 */
  hideDisabledByDefault?: boolean
}) {
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const sources = useNewsletterPickerSources(token, itemsOverride == null)
  const items = itemsOverride ?? sources.items
  const [kind, setKind] = useState<'' | NewsletterSourceKind>('')
  const [query, setQuery] = useState('')
  const [insurer, setInsurer] = useState('')
  const [source, setSource] = useState('all')
  const [showAlreadyAdded, setShowAlreadyAdded] = useState(!hideDisabledByDefault)
  const [previewItem, setPreviewItem] = useState<NewsletterItem | null>(null)
  const [previewDetail, setPreviewDetail] = useState<NewsletterDetail | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [zoom, setZoom] = useState(1)
  const previewRequestIdRef = useRef(0)

  const kindOf = (item: NewsletterItem): NewsletterSourceKind => item.sourceKind ?? 'INSURER'
  const kindCounts = useMemo(() => {
    const counts: Record<NewsletterSourceKind, number> = { INSURER: 0, GA: 0, PUBLIC: 0 }
    for (const item of items) counts[kindOf(item)] += 1
    return counts
  }, [items])
  const kindOptions = [
    { value: '', label: `전체 소식지 (${items.length})` },
    { value: 'INSURER', label: `원수사 (${kindCounts.INSURER})` },
    { value: 'GA', label: `GA (${kindCounts.GA})` },
    { value: 'PUBLIC', label: `공용 (${kindCounts.PUBLIC})` },
  ]
  const insurerOptions = useMemo(() => {
    const names = [...new Set(items.filter((item) => kindOf(item) === 'INSURER').map((item) => item.insurerName).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'ko'),
    )
    return [{ value: '', label: '전체 원수사' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [items])

  const sourceOptions = useMemo(
    () => [
      { value: 'all', label: '모든 폴더' },
      { value: 'favorites', label: `즐겨찾기 (${collections.favoriteNewsletterIds.length})` },
      ...collections.folders.map((folder) => ({
        value: `folder:${folder.id}`,
        label: `📁 ${folder.name} (${folder.count})`,
      })),
    ],
    [collections],
  )

  const rows = useMemo(() => {
    let allowed: Set<string> | null = null
    if (source === 'favorites') allowed = new Set(collections.favoriteNewsletterIds)
    if (source.startsWith('folder:')) {
      const folder = collections.folders.find((f) => `folder:${f.id}` === source)
      allowed = new Set(folder?.newsletterIds ?? [])
    }
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (allowed && !allowed.has(item.id)) return false
      if (kind && kindOf(item) !== kind) return false
      // 원수사 선택은 원수사 종류에서만 적용한다 (GA/공용에는 원수사 조건 미적용).
      if (kind === 'INSURER' && insurer && item.insurerName !== insurer) return false
      if (hideDisabledByDefault && !showAlreadyAdded && disabledIds?.has(item.id)) return false
      if (!q) return true
      return [item.insurerName, item.boardLabel, item.title, item.summary, formatTimestampSearchHaystack(item.publishedAt)]
        .map((v) => String(v ?? '').toLowerCase())
        .join('\n')
        .includes(q)
    })
  }, [collections, disabledIds, hideDisabledByDefault, insurer, items, kind, query, showAlreadyAdded, source])

  const selected = new Set(selectedIds)
  const selectable = rows.filter((row) => !disabledIds?.has(row.id))
  const allChecked = selectable.length > 0 && selectable.every((row) => selected.has(row.id))
  const alreadyCount = disabledIds ? [...disabledIds].filter((id) => items.some((item) => item.id === id)).length : 0

  const toggle = (id: string) => {
    if (disabledIds?.has(id)) return
    onSelectedIdsChange(selected.has(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id])
  }

  const toggleAll = () => {
    if (allChecked) {
      const visible = new Set(selectable.map((row) => row.id))
      onSelectedIdsChange(selectedIds.filter((id) => !visible.has(id)))
    } else {
      onSelectedIdsChange([...new Set([...selectedIds, ...selectable.map((row) => row.id)])])
    }
  }

  const closePreview = () => {
    previewRequestIdRef.current += 1
    setPreviewItem(null)
    setPreviewDetail(null)
    setPreviewLoading(false)
    setPreviewError('')
    setZoom(1)
  }

  const openPreview = (item: NewsletterItem) => {
    setPreviewItem(item)
    setPreviewDetail(null)
    setPreviewLoading(true)
    setPreviewError('')
    setZoom(1)
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    void (async () => {
      try {
        const detail = await loadNewsletterSourceDetail(item, gaCode, token)
        if (previewRequestIdRef.current !== requestId) return
        setPreviewDetail(detail)
        if (!detail) setPreviewError('소식지 상세를 불러오지 못했습니다.')
      } catch (e) {
        if (previewRequestIdRef.current !== requestId) return
        setPreviewError(e instanceof Error ? e.message : '소식지 상세를 불러오지 못했습니다.')
      } finally {
        if (previewRequestIdRef.current === requestId) setPreviewLoading(false)
      }
    })()
  }

  useEffect(() => {
    return () => {
      previewRequestIdRef.current += 1
    }
  }, [])

  // 미리보기가 떠 있을 때 Esc 는 미리보기만 닫는다(아래 폴더/바인더 선택 모달은 유지).
  const previewOpen = previewItem != null
  useEffect(() => {
    if (!previewOpen) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      closePreview()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [previewOpen])

  return (
    <div className="newsletter-picker">
      <div className={`newsletter-picker__controls${showSourceFilter ? '' : ' newsletter-picker__controls--no-source'}`}>
        {showSourceFilter ? (
          <FormSelect
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={sourceOptions}
            aria-label="소식지 출처"
          />
        ) : null}
        <FormSelect
          value={kind}
          onChange={(e) => setKind(e.target.value as '' | NewsletterSourceKind)}
          options={kindOptions}
          aria-label="소식지 종류"
        />
        {kind === 'INSURER' ? (
          <FormSelect
            value={insurer}
            onChange={(e) => setInsurer(e.target.value)}
            options={insurerOptions}
            aria-label="원수사"
          />
        ) : null}
        <FormInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목, 내용, 회사명, 날짜 검색"
          aria-label="소식지 검색"
        />
      </div>
      <div className="newsletter-picker__bar">
        <label className="newsletter-picker__check-all">
          <FormInput type="checkbox" checked={allChecked} onChange={toggleAll} disabled={selectable.length === 0} />
          <span>보이는 항목 전체 선택</span>
        </label>
        <div className="newsletter-picker__bar-right">
          {hideDisabledByDefault && alreadyCount > 0 ? (
            <label className="newsletter-picker__show-added">
              <FormInput
                type="checkbox"
                checked={showAlreadyAdded}
                onChange={(e) => setShowAlreadyAdded(e.target.checked)}
              />
              <span>이미 추가된 소식지 보기 ({alreadyCount})</span>
            </label>
          ) : null}
          <span className="newsletter-picker__count">{selectedIds.length}개 선택</span>
        </div>
      </div>
      {itemsOverride == null && sources.loading ? (
        <div className="newsletter-picker__empty" role="status">소식지를 불러오는 중…</div>
      ) : itemsOverride == null && sources.error ? (
        <div className="newsletter-picker__empty" role="alert">{sources.error}</div>
      ) : rows.length === 0 ? (
        <div className="newsletter-picker__empty" role="status">
          표시할 소식지가 없습니다.
        </div>
      ) : (
        <div className="news-grid newsletter-picker__grid" aria-label="소식지 목록">
          {rows.map((item) => {
            const disabled = disabledIds?.has(item.id) ?? false
            const checked = disabled || selected.has(item.id)
            const title = newsletterItemLabel(item)
            const headline = normalizeInsurerNewsText(item.summary) || normalizeInsurerNewsText(item.title)
            const imageUrl = resolveInsurerNewsListCardImageUrl(item) || null
            const dateLabel = formatInsurerNewsDateLabel(item.publishedAt)

            return (
              <article
                key={item.id}
                className={`news-card assessor-news-card newsletter-picker-card${disabled ? ' is-disabled' : ''}${checked && !disabled ? ' is-selected' : ''}`}
                aria-label={title}
              >
                <div className="newsletter-picker-card__check">
                  <FormInput
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(item.id)}
                    aria-label={`${title} 선택`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {disabled ? (
                  <span className="newsletter-picker-card__badge">{disabledLabel}</span>
                ) : null}
                <div
                  className="card-content card-content--clickable newsletter-picker-card__body"
                  onClick={() => openPreview(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openPreview(item)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${title} 미리보기`}
                >
                  <PickerCardImage imageUrl={imageUrl} headline={headline} />
                  <div className="newsletter-picker-card__meta">
                    <div className="newsletter-picker-card__title">{title}</div>
                    <div className="news-card__meta">
                      <div className="news-card__meta-name">
                        <span className={`newsletter-picker-card__kind newsletter-picker-card__kind--${kindOf(item).toLowerCase()}`}>
                          {NEWSLETTER_SOURCE_KIND_LABEL[kindOf(item)]}
                        </span>{' '}
                        {kindOf(item) === 'INSURER' ? item.insurerName : item.boardLabel || item.insurerName}
                      </div>
                      <div className="news-card__meta-date">{dateLabel}</div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {previewItem != null && typeof document !== 'undefined' ? createPortal(
      <div className="newsletter-picker-preview-layer">
      <NewsDetailViewerModal
        open={previewItem != null}
        onClose={closePreview}
        zoom={zoom}
        onZoomChange={(next) => setZoom(clampNewsDetailViewerZoom(next))}
        onZoomIn={() => setZoom((v) => clampNewsDetailViewerZoom(v + ZOOM_STEP))}
        onZoomOut={() => setZoom((v) => clampNewsDetailViewerZoom(v - ZOOM_STEP))}
        zoomControlVariant="symbols"
        closeLabel="✕"
        loading={previewLoading}
        error={previewError || null}
        ariaLabel={previewItem?.title ? `소식지 미리보기 · ${previewItem.title}` : '소식지 미리보기'}
        headerActions={
          previewItem && !disabledIds?.has(previewItem.id) ? (
            <FormButton
              variant={selected.has(previewItem.id) ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => toggle(previewItem.id)}
            >
              {selected.has(previewItem.id) ? '선택 해제' : '선택'}
            </FormButton>
          ) : null
        }
      >
        <InsurerNewsDetailViewerContent zoom={zoom} detail={previewDetail} item={previewItem} />
      </NewsDetailViewerModal>
      </div>,
      document.body,
      ) : null}
    </div>
  )
}
