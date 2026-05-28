import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import { cdnUrlForObjectKey } from '../lib/insurerNewsCdn'
import type { NewsletterAttachment } from '../types'

const OBJECT_KEY_PREFIXES = ['crm-platform/', 'insurer/', 'insurer-news/', 'files/', 'platform-assets/']

function looksLikeObjectKey(path: string): boolean {
  if (!path || /^https?:\/\//i.test(path)) {
    return false
  }
  if (path.startsWith('/api/') || path.startsWith('/backend/')) {
    return false
  }
  const normalized = path.replace(/^\//, '')
  return OBJECT_KEY_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

/** attachment 표시용 raw URL: url(CDN) → objectKey(CDN) */
export function pickInsurerNewsAttachmentUrl(
  row: Pick<NewsletterAttachment, 'url' | 'objectKey'>,
): string {
  const url = String(row.url ?? '').trim()
  if (url) {
    return url
  }
  const objectKey = String(row.objectKey ?? '').trim()
  if (objectKey) {
    return cdnUrlForObjectKey(objectKey)
  }
  return ''
}

/** img src / open 탭용 절대 URL (CDN URL·objectKey 보정) */
export function resolveInsurerNewsImageUrl(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return ''
  }
  if (looksLikeObjectKey(trimmed)) {
    return resolveAbsoluteApiUrl(cdnUrlForObjectKey(trimmed.replace(/^\//, '')))
  }
  return resolveAbsoluteApiUrl(trimmed)
}

export function resolveInsurerNewsAttachmentDisplayUrl(
  row: Pick<NewsletterAttachment, 'url' | 'objectKey'>,
): string {
  return resolveInsurerNewsImageUrl(pickInsurerNewsAttachmentUrl(row))
}
