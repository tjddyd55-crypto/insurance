import type { NewsletterItem } from '../types'
import { NewsletterCard } from './NewsletterCard'

type Props = {
  items: NewsletterItem[]
  emptyMessage: string
  onOpenItem?: (id: string) => void
  noSearchResults?: boolean
}

export function NewsletterList({ items, emptyMessage, onOpenItem, noSearchResults }: Props) {
  if (!items.length) {
    return (
      <div className="insurer-news-empty" role="status">
        {noSearchResults ? '검색 결과가 없습니다.' : emptyMessage}
      </div>
    )
  }

  return (
    <div className="insurer-news-list-grid">
      {items.map((item) => (
        <NewsletterCard
          key={item.id}
          item={item}
          onOpen={onOpenItem ? () => onOpenItem(item.id) : undefined}
        />
      ))}
    </div>
  )
}
