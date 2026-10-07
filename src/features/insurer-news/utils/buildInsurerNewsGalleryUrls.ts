import type { NewsletterAttachment } from '../types'
import { resolveInsurerNewsAttachmentDisplayUrl } from './resolveInsurerNewsImageUrl'

function isImageAttachment(row: NewsletterAttachment): boolean {
  if (row.kind === 'image') {
    return true
  }
  const mime = String(row.mimeType ?? '').toLowerCase()
  return mime.startsWith('image/')
}

function resolveHeroGalleryUrl(params: {
  heroImageObjectKey?: string | null
  heroImageUrl?: string | null
}): string {
  const heroObjectKey = String(params.heroImageObjectKey ?? '').trim()
  if (heroObjectKey) {
    return resolveInsurerNewsAttachmentDisplayUrl({ objectKey: heroObjectKey, url: '' })
  }
  const heroRaw = String(params.heroImageUrl ?? '').trim()
  if (heroRaw) {
    return resolveInsurerNewsAttachmentDisplayUrl({ url: heroRaw })
  }
  return ''
}

/**
 * 원수사 소식지 상세·목록에서 쓸 이미지 URL 목록(절대 URL, 중복 제거).
 * attachments 순서(sortOrder)를 유지하고 hero 는 목록에 없을 때만 맨 앞에 붙인다.
 */
export function buildInsurerNewsGalleryUrls(params: {
  heroImageUrl?: string | null
  heroImageObjectKey?: string | null
  attachments?: NewsletterAttachment[] | null
}): string[] {
  const rows = [...(params.attachments ?? [])]
    .filter(isImageAttachment)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const fromAttachments = rows
    .map((row) => resolveInsurerNewsAttachmentDisplayUrl(row))
    .filter(Boolean)

  const out: string[] = []
  const seen = new Set<string>()
  const push = (url: string) => {
    if (!url || seen.has(url)) {
      return
    }
    seen.add(url)
    out.push(url)
  }

  const heroResolved = resolveHeroGalleryUrl(params)
  if (heroResolved && !fromAttachments.includes(heroResolved)) {
    push(heroResolved)
  }
  for (const url of fromAttachments) {
    push(url)
  }
  if (out.length === 0 && heroResolved) {
    push(heroResolved)
  }

  return out
}
