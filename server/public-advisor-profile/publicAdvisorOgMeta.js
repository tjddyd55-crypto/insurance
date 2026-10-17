export const ADVISOR_OG_HEADLINE_FALLBACK = 'ONE FC 모바일 명함'

export const ADVISOR_OG_IMAGE_WIDTH = 1200
export const ADVISOR_OG_IMAGE_HEIGHT = 630

/**
 * @param {{ headline?: string | null }} input
 */
export function buildAdvisorOgDescription(input) {
  const headline = String(input.headline ?? '').trim()
  return (headline || ADVISOR_OG_HEADLINE_FALLBACK).slice(0, 200)
}

/**
 * @param {{ displayName?: string | null, heroDisplayTitle?: string | null, heroDisplayTitleVisible?: boolean | null }} input
 */
export function buildAdvisorOgTitle(input) {
  const heroTitle =
    input.heroDisplayTitleVisible !== false ? String(input.heroDisplayTitle ?? '').trim() : ''
  if (heroTitle) return `${heroTitle} | ONE FC`
  const name = String(input.displayName ?? '').trim() || 'ONE FC'
  return `${name} | ONE FC`
}

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

export function buildAdvisorOgCardApiPath(slug, cacheVersion) {
  const s = String(slug ?? '').trim()
  const base = `/api/public/advisors/${encodeURIComponent(s)}/og-card.png`
  const v = buildAdvisorOgImageCacheVersion(cacheVersion)
  return v ? `${base}?v=${encodeURIComponent(v)}` : base
}
