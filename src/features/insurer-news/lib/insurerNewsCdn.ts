/** 서버 `getR2PublicCdnBase`와 동일한 기본값 */
export function getInsurerNewsCdnBase(): string {
  const raw = import.meta.env.VITE_R2_PUBLIC_CDN_BASE as string | undefined
  return String(raw ?? 'https://cdn.platform-assets.com').replace(/\/$/, '')
}

/** CDN 공개 URL path — bucket 이름 prefix(`platform-assets/`)는 제거한다. */
export function normalizeInsurerNewsObjectKeyForCdn(objectKey: string): string {
  return String(objectKey ?? '')
    .trim()
    .replace(/^\//, '')
    .replace(/^platform-assets\//, '')
}

export function cdnUrlForObjectKey(objectKey: string): string {
  const key = normalizeInsurerNewsObjectKeyForCdn(objectKey)
  if (!key) {
    return ''
  }
  return `${getInsurerNewsCdnBase()}/${key}`
}
