import { useState } from 'react'
import type { NewsletterItem } from '../types'
import { formatInsurerNewsDateLabel } from '../utils/formatInsurerNewsDate'
import FormButton from '../../../components/form/FormButton'
import { resolveInsurerNewsListCardImageUrl, insurerNewsListItemHasImageSource } from '../utils/resolveInsurerNewsImageUrl'
import { normalizeInsurerNewsText } from '../utils/insurerNewsText'
import { resolveNewsletterPostAuthorLabel } from '../utils/resolveNewsletterPostAuthorLabel'

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
  const author = resolveNewsletterPostAuthorLabel({
    authorDisplayName: item.authorDisplayName,
    organizationName: item.authorOrganizationName,
    authorName: item.authorName,
    legacyAuthorLabel: item.insurerName,
    boardLabel: item.boardLabel,
  })
  const parts = [author, head].filter(Boolean)
  return parts.length > 0 ? `${parts.join(' — ')} 소식` : '소식지'
}

function MobileNewsCardImage({
  imageUrl,
  onFailed,
}: {
  imageUrl: string
  onFailed: () => void
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return null
  }
  return (
    <img
      className="news-card__mobile-image"
      src={imageUrl}
      alt=""
      loading="lazy"
      onError={() => {
        setFailed(true)
        onFailed()
      }}
    />
  )
}

function MobileNewsCardMedia({
  imageInstanceKey,
  imageUrl,
  hasImageUrl,
  hasHeadline,
  headline,
}: {
  imageInstanceKey: string
  imageUrl: string | null
  hasImageUrl: boolean
  hasHeadline: boolean
  headline: string
}) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const shouldShowTextPreview = !hasImageUrl && hasHeadline

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

  return (
    <>
      {hasImageUrl && imageUrl && !imageLoadFailed ? (
        <MobileNewsCardImage
          key={imageInstanceKey}
          imageUrl={imageUrl}
          onFailed={() => setImageLoadFailed(true)}
        />
      ) : null}
      {shouldShowTextPreview ? textPreviewPlaceholder : null}
      {hasImageUrl && imageLoadFailed ? imageLoadFailedPlaceholder : null}
    </>
  )
}

export function NewsCard({ item, onOpen, onDelete, deleteBusy, variant }: Props) {
  const isMobile = variant === 'mobile'
  const companyName = resolveNewsletterPostAuthorLabel({
    authorDisplayName: item.authorDisplayName,
    organizationName: item.authorOrganizationName,
    authorName: item.authorName,
    legacyAuthorLabel: item.insurerName,
    boardLabel: item.boardLabel,
  })
  const dateLabel = formatInsurerNewsDateLabel(item.publishedAt)
  const headline = normalizeInsurerNewsText(item.summary) || normalizeInsurerNewsText(item.title)
  const hasHeadline = headline.length > 0
  const hasImageUrl = insurerNewsListItemHasImageSource(item)
  const imageUrl = resolveInsurerNewsListCardImageUrl(item)
  const imageInstanceKey = `${item.id}:${imageUrl ?? ''}`

  const textPreviewPlaceholder = (
    <div className="news-card__placeholder news-card__placeholder--content" aria-hidden>
      <span className="news-card__placeholder-label news-card__placeholder-label--headline">
        {headline}
      </span>
    </div>
  )

  const cardMeta = (
    <div className="news-card__meta">
      <div className="news-card__meta-name">{companyName}</div>
      <div className="news-card__meta-date">{dateLabel}</div>
    </div>
  )

  const media = isMobile ? (
    <MobileNewsCardMedia
      key={imageInstanceKey}
      imageInstanceKey={imageInstanceKey}
      imageUrl={imageUrl}
      hasImageUrl={hasImageUrl}
      hasHeadline={hasHeadline}
      headline={headline}
    />
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
