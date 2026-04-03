import type { NewsletterItem } from '../types'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'

type Props = {
  item: NewsletterItem
  onOpen?: () => void
}

export function NewsletterCard({ item, onOpen }: Props) {
  const content = (
    <>
      <div className="insurer-news-card__thumb-wrap" aria-hidden={!item.heroImageUrl}>
        {item.heroImageUrl ? (
          <img className="insurer-news-card__thumb" src={item.heroImageUrl} alt="" loading="lazy" />
        ) : (
          <span className="insurer-news-muted" style={{ fontSize: 12, padding: 8 }}>
            이미지 없음
          </span>
        )}
      </div>
      <div className="insurer-news-card__body">
        <p className="insurer-news-card__insurer">{item.insurerName}</p>
        <h3 className="insurer-news-card__title">{item.title}</h3>
        <p className="insurer-news-card__summary">{item.summary}</p>
        <div className="insurer-news-card__meta">
          <time dateTime={item.publishedAt}>{formatInsurerNewsDateTime(item.publishedAt)}</time>
          {item.hasImages ? <span className="insurer-news-badge insurer-news-badge--accent">이미지</span> : null}
          {item.hasPdf ? <span className="insurer-news-badge">PDF</span> : null}
          {item.hasTextBody ? <span className="insurer-news-badge">본문</span> : null}
        </div>
      </div>
    </>
  )

  if (onOpen) {
    return (
      <button type="button" className="insurer-news-card" onClick={onOpen}>
        {content}
      </button>
    )
  }

  return <div className="insurer-news-card">{content}</div>
}
