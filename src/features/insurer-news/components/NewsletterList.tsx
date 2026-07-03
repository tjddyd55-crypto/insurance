import type { NewsletterItem } from '../types'
import { NewsCard } from './NewsCard'

/**
 * 모든 `NewsCard` 에 동일한 variant 를 전달하기 위한 리스트 래퍼.
 * 페이지 컨테이너(예: `ClaimRequestsPage`)에서 PC/Mobile 을 결정해 주입한다.
 */
type Props = {
  items: NewsletterItem[]
  emptyMessage: string
  variant: 'pc' | 'mobile'
  onOpenItem?: (id: string) => void
  onDeleteItem?: (item: NewsletterItem) => void
  deleteBusyId?: string | null
  /**
   * 아이템별 삭제 버튼 노출 여부. 미지정이면 `onDeleteItem` 이 있을 때 항상 노출한다
   * (기존 호출처 호환). 권한 게이팅이 필요한 목록은 이 predicate 를 주입한다.
   */
  canDeleteItem?: (item: NewsletterItem) => boolean
  noSearchResults?: boolean
}

export function NewsletterList({
  items,
  emptyMessage,
  variant,
  onOpenItem,
  onDeleteItem,
  deleteBusyId,
  canDeleteItem,
  noSearchResults,
}: Props) {
  if (!items.length) {
    return (
      <div className="insurer-news-empty" role="status">
        {noSearchResults ? '검색 결과가 없습니다.' : emptyMessage}
      </div>
    )
  }

  return (
    <div className="news-grid">
      {items.map((item) => {
        const deletable = onDeleteItem != null && (canDeleteItem ? canDeleteItem(item) : true)
        return (
          <NewsCard
            key={item.id}
            item={item}
            variant={variant}
            onOpen={onOpenItem ? () => onOpenItem(item.id) : undefined}
            onDelete={deletable ? () => onDeleteItem!(item) : undefined}
            deleteBusy={Boolean(deleteBusyId && deleteBusyId === item.id)}
          />
        )
      })}
    </div>
  )
}
