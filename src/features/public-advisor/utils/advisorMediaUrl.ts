import { getPublicOrigin } from '../../../lib/publicOrigin'

/** API가 http로 내려준 미디어 URL을 현재 페이지 origin(https)에 맞춘다. */
export function normalizeAdvisorMediaUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? '').trim()
  if (!raw) return null
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw
  try {
    const origin = getPublicOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
    const resolved = origin ? new URL(raw, origin) : new URL(raw)
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      resolved.protocol === 'http:'
    ) {
      resolved.protocol = 'https:'
    }
    return resolved.href
  } catch {
    return raw
  }
}

export function advisorMediaUrlFromObjectKey(
  objectKey: string | null | undefined,
  version?: string | number,
): string | null {
  const key = String(objectKey ?? '').trim()
  if (!key) return null
  const origin = (getPublicOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  )
  const path = `/api/public/advisor-media?key=${encodeURIComponent(key)}`
  let url = origin ? `${origin}${path}` : path
  if (version != null) {
    url += `&v=${encodeURIComponent(String(version))}`
  }
  return normalizeAdvisorMediaUrl(url)
}
