import type { NewsletterItem } from '../types'

type Props = {
  item: NewsletterItem
  onOpen?: () => void
}

function cardAriaLabel(item: NewsletterItem): string {
  const head = item.summary?.trim() ? item.summary.trim().slice(0, 40) : ''
  const parts = [item.insurerName, head].filter(Boolean)
  return parts.length > 0 ? `${parts.join(' — ')} 소식` : '소식지'
}

export function NewsCard({ item, onOpen }: Props) {
  const companyName = item.insurerName?.trim() || '—'
  const media = (
    <div className="news-card__media">
      {item.heroImageUrl ? (
        <img src={item.heroImageUrl} alt="" loading="lazy" />
      ) : (
        <div className="news-card__placeholder" aria-hidden>
          <span className="news-card__placeholder-label">이미지 없음</span>
        </div>
      )}
      <div className="overlay">
        <div>{companyName}</div>
        <div>등록</div>
      </div>
    </div>
  )

  if (onOpen) {
    return (
      <button type="button" className="news-card" onClick={onOpen} aria-label={cardAriaLabel(item)}>
        {media}
      </button>
    )
  }

  return (
    <div className="news-card news-card--static" role="article" aria-label={cardAriaLabel(item)}>
      {media}
    </div>
  )
}
