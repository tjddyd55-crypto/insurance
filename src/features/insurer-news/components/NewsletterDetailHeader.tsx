import type { NewsletterItem } from '../types'
import { formatInsurerNewsDateTime } from '../utils/formatInsurerNewsDate'
import { resolveNewsletterPostAuthorLabel } from '../utils/resolveNewsletterPostAuthorLabel'

/** @deprecated 상세 페이지는 날짜·본문을 페이지에서 직접 구성합니다. 레거시용으로만 유지 */
type Props = {
  item: Pick<
    NewsletterItem,
    'insurerName' | 'publishedAt' | 'authorDisplayName' | 'authorName' | 'authorOrganizationName' | 'boardLabel'
  >
}

export function NewsletterDetailHeader({ item }: Props) {
  const authorLabel = resolveNewsletterPostAuthorLabel({
    authorDisplayName: item.authorDisplayName,
    organizationName: item.authorOrganizationName,
    authorName: item.authorName,
    legacyAuthorLabel: item.insurerName,
    boardLabel: item.boardLabel,
  })
  return (
    <header>
      <p className="insurer-news-detail-header__insurer">{authorLabel}</p>
      <p className="insurer-news-detail-header__time">
        <time dateTime={item.publishedAt}>{formatInsurerNewsDateTime(item.publishedAt)}</time>
      </p>
    </header>
  )
}
