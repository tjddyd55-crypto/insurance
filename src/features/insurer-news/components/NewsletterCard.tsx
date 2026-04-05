import type { NewsletterItem } from '../types'

type Props = {
  item: NewsletterItem
  onOpen?: () => void
}

function cardAriaLabel(item: NewsletterItem): string {
  const parts = [item.insurerName, item.title].filter(Boolean)
  return parts.length > 0 ? `${parts.join(' — ')} 소식` : '소식지'
}

export function NewsletterCard({ item, onOpen }: Props) {
  const content = (
    <div className="insurer-news-card__media">
      {item.heroImageUrl ? (
        <img className="insurer-news-card__thumb" src={item.heroImageUrl} alt="" loading="lazy" />
      ) : (
        <div className="insurer-news-card__placeholder">
          <span className="insurer-news-card__placeholder-text">이미지 없음</span>
        </div>
      )}
      <div className="insurer-news-card__overlay">{item.insurerName}</div>
    </div>
  )

  if (onOpen) {
    return (
      <button type="button" className="insurer-news-card" onClick={onOpen} aria-label={cardAriaLabel(item)}>
        {content}
      </button>
    )
  }

  return (
    <div className="insurer-news-card" role="article" aria-label={cardAriaLabel(item)}>
      {content}
    </div>
  )
}
