import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import { cdnUrlForObjectKey } from '../lib/insurerNewsCdn'
import type { NewsletterAttachment, NewsletterItem } from '../types'

/** R2 object key 로 보이는 path prefix (SSOT `insurance/` 포함) */
const OBJECT_KEY_PREFIXES = [
  'insurance/',
  'crm-platform/',
  'insurer/',
  'insurer-news/',
  'files/',
  'platform-assets/',
]

export type NewsletterAttachmentViewSource = Pick<
  NewsletterAttachment,
  'url' | 'objectKey'
> & {
  fileUrl?: string | null
  file_url?: string | null
}

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

function absoluteCdnUrlForObjectKey(objectKey: string): string {
  return resolveAbsoluteApiUrl(cdnUrlForObjectKey(objectKey))
}

/**
 * 소식지 첨부·대표 이미지 표시 URL (상세 갤러리·목록 카드 공통).
 * 1. objectKey → CDN 절대 URL
 * 2. url/fileUrl 절대 http(s) → 그대로
 * 3. url이 object key 형태 → CDN
 */
export function resolveNewsletterAttachmentViewUrl(
  source: NewsletterAttachmentViewSource,
): string {
  const objectKey = String(source.objectKey ?? '').trim()
  if (objectKey) {
    return absoluteCdnUrlForObjectKey(objectKey)
  }

  const legacyUrl = String(source.url ?? source.fileUrl ?? source.file_url ?? '').trim()
  if (!legacyUrl) {
    return ''
  }
  if (/^https?:\/\//i.test(legacyUrl)) {
    return resolveAbsoluteApiUrl(legacyUrl)
  }
  if (looksLikeObjectKey(legacyUrl)) {
    return absoluteCdnUrlForObjectKey(legacyUrl.replace(/^\//, ''))
  }
  return resolveAbsoluteApiUrl(legacyUrl)
}

/** @deprecated {@link resolveNewsletterAttachmentViewUrl} */
export const resolveInsurerNewsAttachmentDisplayUrl = resolveNewsletterAttachmentViewUrl

/** 목록 카드·hero — objectKey 우선, 구형 heroImageUrl fallback */
export function resolveNewsletterHeroViewUrl(
  item: Pick<NewsletterItem, 'heroImageObjectKey' | 'heroImageUrl'>,
): string {
  return resolveNewsletterAttachmentViewUrl({
    objectKey: item.heroImageObjectKey,
    url: item.heroImageUrl,
  })
}

export function newsletterItemHasImageSource(
  item: Pick<NewsletterItem, 'heroImageObjectKey' | 'heroImageUrl'>,
): boolean {
  return Boolean(String(item.heroImageObjectKey ?? '').trim() || String(item.heroImageUrl ?? '').trim())
}

/** img src / open 탭용 — 이미 절대 URL이거나 raw object key·legacy path 보정 */
export function resolveInsurerNewsImageUrl(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return ''
  }
  if (looksLikeObjectKey(trimmed)) {
    return absoluteCdnUrlForObjectKey(trimmed.replace(/^\//, ''))
  }
  return resolveAbsoluteApiUrl(trimmed)
}
