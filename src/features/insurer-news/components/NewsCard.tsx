import { useEffect, useState } from 'react'
import type { NewsletterItem } from '../types'
import { formatInsurerNewsDateLabel } from '../utils/formatInsurerNewsDate'
import FormButton from '../../../components/form/FormButton'
import { resolveInsurerNewsListCardImageUrl, insurerNewsListItemHasImageSource } from '../utils/resolveInsurerNewsImageUrl'
import { normalizeInsurerNewsText } from '../utils/insurerNewsText'

/**
 * PC/Mobile 분기는 `variant` prop 으로 승격 (AGENTS.md §8-5 Tier 4/3 참조).
 * NewsCard 내부에서 useIsMobile 을 직접 호출하지 않으며, 호출 측(NewsletterList)
 * 또는 그 위의 페이지 컨테이너(ClaimRequestsPage 등)가 variant 를 결정해 주입한다.
 */
type Props = {
  item: NewsletterItem
  onOpen?: () => void
  onDelete?: () => void
  deleteBusy?: boolean
  variant: 'pc' | 'mobile'
}

function cardAriaLabel(item: NewsletterItem): string {
  const headline = normalizeInsurerNewsText(item.summary) || normalizeInsurerNewsText(item.title)
  const head = headline ? headline.slice(0, 40) : ''
  const parts = [item.insurerName, head].filter(Boolean)
  return parts.length > 0 ? `${parts.join(' — ')} 소식` : '소식지'
}

export function NewsCard({ item, onOpen, onDelete, deleteBusy, variant }: Props) {
  const isMobile = variant === 'mobile'
  const companyName = item.insurerName?.trim() || '—'
  const dateLabel = formatInsurerNewsDateLabel(item.publishedAt)
  const headline = normalizeInsurerNewsText(item.summary) || normalizeInsurerNewsText(item.title)
  const hasHeadline = headline.length > 0
  const hasImageUrl = insurerNewsListItemHasImageSource(item)
  const imageUrl = resolveInsurerNewsListCardImageUrl(item)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  useEffect(() => {
    setImageLoadFailed(false)
  }, [item.id, imageUrl])

  const shouldShowImage = hasImageUrl && !imageLoadFailed
  // 이미지가 없을 때만, 그리고 실제 텍스트가 있을 때만 텍스트 미리보기를 노출한다.
  // (이미지 없음 + 텍스트 없음 → placeholder 문구를 강제로 만들지 않는다)
  const shouldShowTextPreview = isMobile && !hasImageUrl && hasHeadline
  const shouldShowImageFailed = isMobile && hasImageUrl && imageLoadFailed

  const textPreviewPlaceholder = (
    <div className="news-card__placeholder news-card__placeholder--content" aria-hidden>
      <span className="news-card__placeholder-label news-card__placeholder-label--headline">
        {headline}
      </span>
    </div>
  )

  const imageLoadFailedPlaceholder = (
    <div className="news-card__placeholder news-card__placeholder--load-failed" role="status">
      <span className="news-card__placeholder-label">이미지를 불러오지 못했습니다.</span>
    </div>
  )

  const cardMeta = (
    <div className="news-card__meta">
      <div className="news-card__meta-name">{companyName}</div>
      <div className="news-card__meta-date">{dateLabel}</div>
    </div>
  )

  const media = isMobile ? (
    <>
      {shouldShowImage ? (
        <img
          className="news-card__mobile-image"
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageLoadFailed(true)}
        />
      ) : null}
      {shouldShowTextPreview ? textPreviewPlaceholder : null}
      {shouldShowImageFailed ? imageLoadFailedPlaceholder : null}
    </>
  ) : (
    <div className="news-card__media">
      {hasImageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" />
      ) : hasHeadline ? (
        textPreviewPlaceholder
      ) : null}
    </div>
  )

  const mediaBlock =
    onOpen != null ? (
      <div
        className="card-content card-content--clickable"
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
        role="button"
        tabIndex={0}
      >
        {media}
        {cardMeta}
      </div>
    ) : (
      <div className="card-content">
        {media}
        {cardMeta}
      </div>
    )

  const deleteFooter =
    onDelete != null ? (
      <div
        className={`news-card__actions${isMobile ? ' news-card__actions--mobile' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <FormButton
          htmlType="button"
          variant="danger"
          size={isMobile ? 'sm' : 'sm'}
          loading={Boolean(deleteBusy)}
          disabled={Boolean(deleteBusy)}
          className="news-card__delete"
          onClick={() => onDelete()}
        >
          삭제
        </FormButton>
      </div>
    ) : null

  if (onOpen != null) {
    return (
      <div
        className={`news-card assessor-news-card${isMobile ? ' news-card--mobile' : ''}`}
        aria-label={cardAriaLabel(item)}
      >
        {mediaBlock}
        {deleteFooter}
      </div>
    )
  }

  return (
    <div
      className={`news-card assessor-news-card news-card--static${isMobile ? ' news-card--mobile' : ''}`}
      role="article"
      aria-label={cardAriaLabel(item)}
    >
      {mediaBlock}
      {deleteFooter}
    </div>
  )
}
