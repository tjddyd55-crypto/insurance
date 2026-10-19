import { createHash } from 'node:crypto'

export {
  ADVISOR_SHARE_DESCRIPTION_FALLBACK,
  ADVISOR_SHARE_TITLE_FALLBACK,
  ADVISOR_SHARE_UNAVAILABLE_DESCRIPTION,
  ADVISOR_SHARE_UNAVAILABLE_TITLE,
  buildAdvisorOgDescription,
  buildAdvisorOgTitle,
} from '../../src/features/public-advisor/utils/buildAdvisorShareMeta.js'

export const ADVISOR_OG_IMAGE_WIDTH = 1200
export const ADVISOR_OG_IMAGE_HEIGHT = 630

/**
 * @param {string | number | Date | null | undefined} cacheVersion
 */
export function buildAdvisorOgImageCacheVersion(cacheVersion) {
  if (cacheVersion == null || cacheVersion === '') return ''
  if (cacheVersion instanceof Date) {
    const ms = cacheVersion.getTime()
    return Number.isFinite(ms) ? String(ms) : ''
  }
  const s = String(cacheVersion).trim()
  if (!s) return ''
  const asNum = Number(s)
  if (Number.isFinite(asNum) && asNum > 0) return String(Math.floor(asNum))
  const parsed = Date.parse(s)
  return Number.isFinite(parsed) ? String(parsed) : s
}

/**
 * `og-card.png?v=` changes when the profile timestamp changes, when the
 * business-card front key changes, or when that media's updatedAt is newer.
 * The card key is part of the value so two updates that share a timestamp
 * still produce different URLs.
 *
 * @param {{
 *   profileUpdatedAt?: string | number | Date | null
 *   businessCardFrontObjectKey?: string | null
 *   businessCardMediaUpdatedAt?: string | number | Date | null
 * }} input
 */
export function buildAdvisorOgCardCacheVersion(input) {
  const profileStamp = buildAdvisorOgImageCacheVersion(input?.profileUpdatedAt)
  const mediaStamp = buildAdvisorOgImageCacheVersion(input?.businessCardMediaUpdatedAt)
  const stamps = [profileStamp, mediaStamp]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
  const stamp = stamps.length ? String(Math.max(...stamps)) : ''
  const key = String(input?.businessCardFrontObjectKey ?? '').trim()
  if (!key) return stamp
  const keyHash = createHash('sha1').update(key).digest('hex').slice(0, 10)
  return stamp ? `${stamp}-${keyHash}` : keyHash
}

export function buildAdvisorOgCardApiPath(slug, cacheVersion) {
  const s = String(slug ?? '').trim()
  const base = `/api/public/advisors/${encodeURIComponent(s)}/og-card.png`
  const v = buildAdvisorOgImageCacheVersion(cacheVersion)
  return v ? `${base}?v=${encodeURIComponent(v)}` : base
}
