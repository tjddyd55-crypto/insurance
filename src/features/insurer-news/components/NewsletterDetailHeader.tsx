import type { NewsletterItem } from '../types'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'

type Props = {
  item: Pick<NewsletterItem, 'insurerName' | 'title' | 'publishedAt'>
}

export function NewsletterDetailHeader({ item }: Props) {
  return (
    <header>
      <p className="insurer-news-detail-header__insurer">{item.insurerName}</p>
      <h1 className="insurer-news-detail-header__title">{item.title}</h1>
      <p className="insurer-news-detail-header__time">
        <time dateTime={item.publishedAt}>{formatInsurerNewsDateTime(item.publishedAt)}</time>
      </p>
    </header>
  )
}
