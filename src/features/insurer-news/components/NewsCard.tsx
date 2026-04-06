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

function formatPublishedDateLabel(iso: string): string {
  const s = iso?.trim() ?? ''
  if (!s) return '—'
  const ymd = s.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return ymd
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return ymd || '—'
}

export function NewsCard({ item, onOpen }: Props) {
  const companyName = item.insurerName?.trim() || '—'
  const dateLabel = formatPublishedDateLabel(item.publishedAt)
  const media = (
    <div className="news-card__media">
      {item.heroImageUrl ? (
        <img src={item.heroImageUrl} alt="" loading="lazy" />
      ) : (
        <div className="news-card__placeholder" aria-hidden>
          <span className="news-card__placeholder-label">이미지 없음</span>
        </div>
      )}
      <div className="news-card__overlay">
        <div className="news-card__overlay-name">{companyName}</div>
        <div className="news-card__overlay-date">{dateLabel}</div>
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
