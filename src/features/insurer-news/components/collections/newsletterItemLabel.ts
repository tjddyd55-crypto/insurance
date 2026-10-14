import type { NewsletterItem } from '../../types'

export function newsletterItemLabel(item: NewsletterItem) {
  return (item.title || item.summary || '소식지').trim()
}
