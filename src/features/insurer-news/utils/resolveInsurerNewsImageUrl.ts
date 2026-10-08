import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import { cdnUrlForObjectKey } from '../lib/insurerNewsCdn'
import type { NewsletterAttachment, NewsletterItem } from '../types'

const OBJECT_KEY_PREFIXES = [
  'insurance/',
  'crm-platform/',
  'insurer/',
  'insurer-news/',
  'files/',
  'platform-assets/',
]

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

/** attachment 표시용 raw URL: objectKey(CDN) → url(CDN) */
export function pickInsurerNewsAttachmentUrl(
  row: Pick<NewsletterAttachment, 'url' | 'objectKey'>,
): string {
  const objectKey = String(row.objectKey ?? '').trim()
  if (objectKey) {
    return cdnUrlForObjectKey(objectKey)
  }
  const url = String(row.url ?? '').trim()
  if (url) {
    return url
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

/**
 * 목록 카드 대표 이미지 — 상세 `buildInsurerNewsGalleryUrls` 와 동일 SSOT.
 * objectKey는 CDN으로 직접 변환(구 `insurance/` 키를 상대경로로 오인하지 않음).
 */
export function resolveInsurerNewsListCardImageUrl(
  item: Pick<NewsletterItem, 'heroImageObjectKey' | 'heroImageUrl' | 'heroImageOpenUrl'>,
): string {
  const viaAttachment = resolveInsurerNewsAttachmentDisplayUrl({
    objectKey: item.heroImageObjectKey,
    url: item.heroImageUrl,
  })
  if (viaAttachment) {
    return viaAttachment
  }
  const openUrl = String(item.heroImageOpenUrl ?? '').trim()
  if (openUrl) {
    return resolveAbsoluteApiUrl(openUrl)
  }
  return ''
}

export function insurerNewsListItemHasImageSource(
  item: Pick<NewsletterItem, 'heroImageObjectKey' | 'heroImageUrl' | 'heroImageOpenUrl'>,
): boolean {
  return Boolean(resolveInsurerNewsListCardImageUrl(item))
}
