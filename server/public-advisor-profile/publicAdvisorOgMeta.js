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

export function buildAdvisorOgCardApiPath(slug) {
  const s = String(slug ?? '').trim()
  return `/api/public/advisors/${encodeURIComponent(s)}/og-card.png`
}
