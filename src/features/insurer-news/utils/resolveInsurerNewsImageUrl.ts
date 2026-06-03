import type { NewsletterAttachment, NewsletterItem } from '../types'
import {
  newsletterItemHasImageSource,
  resolveNewsletterAttachmentViewUrl,
  resolveNewsletterHeroViewUrl,
} from './resolveNewsletterAttachmentViewUrl'

export {
  resolveInsurerNewsImageUrl,
  resolveNewsletterAttachmentViewUrl,
  resolveNewsletterHeroViewUrl,
  newsletterItemHasImageSource,
} from './resolveNewsletterAttachmentViewUrl'
export type { NewsletterAttachmentViewSource } from './resolveNewsletterAttachmentViewUrl'

/** @deprecated 내부 호환 — {@link resolveNewsletterAttachmentViewUrl} 사용 */
export function pickInsurerNewsAttachmentUrl(
  row: Pick<NewsletterAttachment, 'url' | 'objectKey'>,
): string {
  return resolveNewsletterAttachmentViewUrl(row)
}

/** 상세 갤러리·첨부 표시 — {@link resolveNewsletterAttachmentViewUrl} 와 동일 */
export function resolveInsurerNewsAttachmentDisplayUrl(
  row: Pick<NewsletterAttachment, 'url' | 'objectKey'>,
): string {
  return resolveNewsletterAttachmentViewUrl(row)
}

/** 목록 카드 썸네일 — 상세와 동일한 hero URL 해석 */
export function resolveInsurerNewsListCardImageUrl(
  item: Pick<NewsletterItem, 'heroImageObjectKey' | 'heroImageUrl'>,
): string {
  return resolveNewsletterHeroViewUrl(item)
}

export function insurerNewsListItemHasImageSource(
  item: Pick<NewsletterItem, 'heroImageObjectKey' | 'heroImageUrl'>,
): boolean {
  return newsletterItemHasImageSource(item)
}
